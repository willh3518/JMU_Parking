// Tests for plugins/withIOSSceneLifecycle.js — the config plugin that keeps the
// prebuilt iOS app launching on iOS 27, which aborts any app that has not
// adopted the UIScene lifecycle (crash in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
//
// The fixtures below are the relevant parts of what `expo prebuild` generates
// for Expo SDK 54 (ios/<App>/AppDelegate.swift and ios/Podfile).
//
// Run with: node --experimental-strip-types --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addSceneDelegate,
  addSceneManifest,
  raisePodDeploymentTargets,
  SCENE_DELEGATE_CLASS,
  MIN_POD_DEPLOYMENT_TARGET,
} = require('../plugins/withIOSSceneLifecycle');

const SDK54_APP_DELEGATE = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

const SDK54_PODFILE = `target 'CampusPark' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

test('addSceneDelegate stops creating the window in didFinishLaunching', () => {
  const result = addSceneDelegate(SDK54_APP_DELEGATE);

  assert.ok(!result.includes('UIWindow(frame: UIScreen.main.bounds)'));
  assert.ok(result.includes('bindReactNativeFactory(factory)'));
  assert.ok(result.includes('return super.application(application, didFinishLaunchingWithOptions: launchOptions)'));
});

test('addSceneDelegate appends a SceneDelegate that starts React Native in the scene window', () => {
  const result = addSceneDelegate(SDK54_APP_DELEGATE);

  assert.match(result, /class SceneDelegate: UIResponder, UIWindowSceneDelegate/);
  assert.match(result, /UIWindow\(windowScene: windowScene\)/);
  assert.match(result, /startReactNative\(\s*withModuleName: "main"/);
  assert.match(result, /makeKeyAndVisible\(\)/);
});

// Deep links must go through the AppDelegate's own open/continue handlers:
// ExpoAppDelegate fans those out to expo-linking, which is where expo-router
// reads the initial URL on iOS. Calling RCTLinkingManager directly skips
// expo-linking, so cold-start links landed on "/" instead of the target route.
function sceneWillConnectBody(swift) {
  const start = swift.indexOf('willConnectTo session');
  const end = swift.indexOf('func scene(_ scene: UIScene, openURLContexts');
  return swift.slice(start, end);
}

test('addSceneDelegate hands cold-start URLs to the AppDelegate before React Native starts', () => {
  const body = sceneWillConnectBody(addSceneDelegate(SDK54_APP_DELEGATE));

  const forward = body.indexOf('appDelegate.application(UIApplication.shared, open: url');
  const start = body.indexOf('startReactNative(');
  assert.ok(forward !== -1, 'cold-start URL must be forwarded to the AppDelegate');
  assert.ok(forward < start, 'URL must be registered before React Native reads its initial URL');
  assert.match(body, /connectionOptions\.urlContexts\.first\?\.url/);
});

test('addSceneDelegate hands cold-start universal links to the AppDelegate', () => {
  const body = sceneWillConnectBody(addSceneDelegate(SDK54_APP_DELEGATE));

  assert.match(body, /connectionOptions\.userActivities\.first/);
  assert.match(body, /appDelegate\.application\(\s*UIApplication\.shared,\s*continue: userActivity/);
});

test('addSceneDelegate hands warm deep links to the AppDelegate', () => {
  const result = addSceneDelegate(SDK54_APP_DELEGATE);
  const warm = result.slice(result.indexOf('func scene(_ scene: UIScene, openURLContexts'));

  assert.match(warm, /\.application\(UIApplication\.shared, open: url/);
  assert.match(warm, /func scene\(_ scene: UIScene, continue userActivity: NSUserActivity\)/);
  assert.doesNotMatch(
    result.slice(result.indexOf('class SceneDelegate')),
    /RCTLinkingManager\.application/,
    'SceneDelegate must go through the AppDelegate, not call RCTLinkingManager directly'
  );
});

test('addSceneDelegate is idempotent', () => {
  const once = addSceneDelegate(SDK54_APP_DELEGATE);
  assert.equal(addSceneDelegate(once), once);
});

test('addSceneDelegate throws when the template no longer matches', () => {
  assert.throws(
    () => addSceneDelegate('public class AppDelegate: ExpoAppDelegate {}'),
    /window setup/
  );
});

test('addSceneManifest declares a single-window scene backed by SceneDelegate', () => {
  const plist = { CFBundleName: 'Campus Park' };
  const result = addSceneManifest(plist);

  assert.deepEqual(result.UIApplicationSceneManifest, {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default',
          UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
        },
      ],
    },
  });
  assert.equal(result.CFBundleName, 'Campus Park');
});

test('addSceneManifest does not mutate its input', () => {
  const plist = { CFBundleName: 'Campus Park' };
  addSceneManifest(plist);
  assert.deepEqual(plist, { CFBundleName: 'Campus Park' });
});

test('raisePodDeploymentTargets raises every pod target after react_native_post_install', () => {
  const result = raisePodDeploymentTargets(SDK54_PODFILE);

  const postInstallCall = result.indexOf('react_native_post_install(');
  const override = result.indexOf(`'IPHONEOS_DEPLOYMENT_TARGET'`);
  assert.ok(override > postInstallCall, 'override must run after react_native_post_install');
  assert.ok(result.includes(`'${MIN_POD_DEPLOYMENT_TARGET}'`));
  assert.ok(result.includes('installer.pods_project.targets.each'));
});

test('raisePodDeploymentTargets is idempotent', () => {
  const once = raisePodDeploymentTargets(SDK54_PODFILE);
  assert.equal(raisePodDeploymentTargets(once), once);
});

test('raisePodDeploymentTargets throws when there is no react_native_post_install call', () => {
  assert.throws(() => raisePodDeploymentTargets("target 'X' do\nend\n"), /react_native_post_install/);
});
