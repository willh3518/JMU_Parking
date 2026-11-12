// Expo config plugin: keep the prebuilt iOS app launching on iOS 27.
//
// 1. iOS 27 aborts any app that has not adopted the UIScene lifecycle
//    (SIGTRAP in _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
//    The Expo SDK 54 AppDelegate template creates its own UIWindow, so we move
//    window creation into a SceneDelegate and declare it in Info.plist.
// 2. Xcode 27 rejects pod targets whose deployment target is below iOS 15
//    (SDWebImage and the react-native-maps privacy bundle still declare 9/11),
//    so every pod target is raised to MIN_POD_DEPLOYMENT_TARGET.
//
// Remove this plugin once the Expo SDK template adopts UIScene on its own.

const { withAppDelegate, withInfoPlist, withPodfile } = require('expo/config-plugins');

const SCENE_DELEGATE_CLASS = '$(PRODUCT_MODULE_NAME).SceneDelegate';
const MIN_POD_DEPLOYMENT_TARGET = '15.1';
const SCENE_DELEGATE_MARKER = 'class SceneDelegate: UIResponder, UIWindowSceneDelegate';
const PODFILE_MARKER = '# [withIOSSceneLifecycle] raise pod deployment targets';

// The template's window setup inside didFinishLaunchingWithOptions.
const APP_DELEGATE_WINDOW_SETUP =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n[\s\S]*?#endif\n/;

const SCENE_DELEGATE_SWIFT = `
// Added by plugins/withIOSSceneLifecycle.js: iOS 27 requires the UIScene lifecycle.
${SCENE_DELEGATE_MARKER} {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    window.makeKeyAndVisible()
  }

  // Deep links delivered while the app is running arrive here, not on the AppDelegate.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

const PODFILE_SNIPPET = `
    ${PODFILE_MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_POD_DEPLOYMENT_TARGET}'
      end
    end`;

/**
 * Move window creation from the AppDelegate into an appended SceneDelegate.
 * @param {string} src AppDelegate.swift contents
 * @returns {string}
 */
function addSceneDelegate(src) {
  if (src.includes(SCENE_DELEGATE_MARKER)) return src;
  if (!APP_DELEGATE_WINDOW_SETUP.test(src)) {
    throw new Error(
      '[withIOSSceneLifecycle] Could not find the AppDelegate window setup to replace. ' +
        'The Expo template has changed; check whether this plugin is still needed.'
    );
  }
  const withoutWindow = src.replace(
    APP_DELEGATE_WINDOW_SETUP,
    '    // The window is created by SceneDelegate (UIScene lifecycle).\n'
  );
  return withoutWindow + SCENE_DELEGATE_SWIFT;
}

/**
 * Return a copy of the Info.plist with a single-window scene manifest.
 * @param {Record<string, unknown>} infoPlist
 * @returns {Record<string, unknown>}
 */
function addSceneManifest(infoPlist) {
  return {
    ...infoPlist,
    UIApplicationSceneManifest: {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    },
  };
}

/**
 * Raise every pod target's deployment target after react_native_post_install runs.
 * @param {string} podfile Podfile contents
 * @returns {string}
 */
function raisePodDeploymentTargets(podfile) {
  if (podfile.includes(PODFILE_MARKER)) return podfile;
  const postInstallCall = /react_native_post_install\([\s\S]*?\n\s*\)/;
  if (!postInstallCall.test(podfile)) {
    throw new Error('[withIOSSceneLifecycle] Could not find react_native_post_install(...) in the Podfile.');
  }
  return podfile.replace(postInstallCall, (call) => call + PODFILE_SNIPPET);
}

/** @param {import('expo/config-plugins').ExpoConfig} config */
function withIOSSceneLifecycle(config) {
  const withDelegate = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('[withIOSSceneLifecycle] Only a Swift AppDelegate is supported.');
    }
    return {
      ...cfg,
      modResults: { ...cfg.modResults, contents: addSceneDelegate(cfg.modResults.contents) },
    };
  });
  const withManifest = withInfoPlist(withDelegate, (cfg) => ({
    ...cfg,
    modResults: addSceneManifest(cfg.modResults),
  }));
  return withPodfile(withManifest, (cfg) => ({
    ...cfg,
    modResults: { ...cfg.modResults, contents: raisePodDeploymentTargets(cfg.modResults.contents) },
  }));
}

module.exports = withIOSSceneLifecycle;
module.exports.addSceneDelegate = addSceneDelegate;
module.exports.addSceneManifest = addSceneManifest;
module.exports.raisePodDeploymentTargets = raisePodDeploymentTargets;
module.exports.SCENE_DELEGATE_CLASS = SCENE_DELEGATE_CLASS;
module.exports.MIN_POD_DEPLOYMENT_TARGET = MIN_POD_DEPLOYMENT_TARGET;
