# Smart Parking Recommendation Algorithm

## Overview
The home screen uses an intelligent algorithm to recommend the best parking options based on the user's destination on campus.

## How It Works

### 1. Distance Calculation
- Uses the Haversine formula to calculate walking distance between the destination building and each parking spot
- Converts coordinates to real-world distances in feet
- Accounts for the Earth's curvature for accurate measurements

### 2. Live Data Integration
- Fetches real-time parking availability from JMU's parking API
- Prioritizes parking decks with live data over those without
- Shows current available spaces for parking decks

### 3. Smart Prioritization Algorithm

The algorithm sorts parking recommendations using these criteria (in order of priority):

1. **Availability First**: If both spots have live data:
   - Spots with available spaces rank higher than full spots
   - If distances are similar (within 0.1 miles), prioritize more available spaces

2. **Live Data Preference**: If distances are similar (within 0.2 miles):
   - Parking decks with live data rank higher than those without
   - This ensures users get real-time availability information

3. **Distance**: Finally, sort by walking distance
   - Closer parking spots rank higher
   - Distance is the tiebreaker when other factors are equal

### 4. Settings Integration

The parking recommendations now respect user filter preferences from the Settings tab:

- **Filter Enforcement**: Only parking types enabled in Settings are included in recommendations
- **Real-time Updates**: Changing settings immediately updates parking suggestions
- **Visual Feedback**: Shows which parking types are currently enabled
- **Quick Access**: Direct link to Settings from the search results

**Filter Types:**
- **Commuter Parking**: Standard commuter lots
- **Resident Parking**: Residence hall parking areas
- **Parking Decks**: Multi-level parking structures with live availability
- **Faculty/Staff Parking**: Available to commuters after 4pm weekdays and weekends
- **Downtown Public Parking**: City-managed parking areas

**Example Scenarios:**
- If only "Parking Decks" is selected → Only shows parking deck recommendations
- If "Commuter" + "Parking Deck" selected → Shows both types, prioritizing decks with live data
- If no types selected → No parking recommendations shown

### 4. User Experience Features

- **Real-time Search**: Instant building suggestions as you type
- **Category Filtering**: Search by building category (Academic, Recreation, etc.)
- **Visual Indicators**: 
  - Green dot = spaces available
  - Red dot = no spaces available
  - Distance shown in feet for easy understanding
- **Quick Actions**: Direct link to view recommendations on the map

## Official JMU Buildings Database

The system now includes **101 official JMU buildings** from the complete university directory across 8 categories:

### **Academic Buildings (30)**
- Wilson Hall (WILS) - Main administration building - 951 Madison Drive
- Carrier Library (CARR) - Main library and learning commons - 1251 Carrier Drive
- ISAT/CS Building (ISAT) - Integrated Science and Technology - 701 Carrier Drive
- Showker Hall (SHOW) - College of Business - 421 Bluestone Drive
- Zane Showker Hall (ZSH) - College of Business - 421 Bluestone Drive
- Miller Hall (MILL) - Biology, Chemistry - 91 East Grace Street
- Physics/Chemistry Building (PCB) - Physical sciences - 901 Carrier Drive
- Bioscience Building (BIO) - Life sciences - 951 Carrier Drive
- Memorial Hall (MEMH) - Academic building - 395 South High Street
- Burruss Hall (BURR) - Academic building - 800 South Main Street
- And 20 more academic buildings...

### **Recreation & Athletics (18)**
- University Recreation Center/UREC (UREC) - Main recreation center - 701 Driver Drive
- Convocation Center (CONVO) - Basketball arena - 1598 South Main Street
- Godwin Hall (GODW) - Recreation and fitness - 261 Bluestone Drive
- Plecker Athletic Performance Center (PAPC) - Athletic training - 371 Bluestone Drive
- Memorial Baseball Stadium (MBS) - Baseball stadium - 270 Veterans Memorial Drive
- Sentara Park facilities - Baseball and athletics
- Veterans Memorial Park - Memorial and recreation - 230 Veterans Memorial Drive
- And 11 more recreation/athletic facilities...

### **Residence Halls (23)**
- Devon Lane area: Ashby, Bell, Bluestone, Chandler, Chesapeake, Dingledine, Eagle, Frederikson, Garber, Gifford, Hanson, Hoffman, Huffman, Lakeview, Logan halls
- Bluestone Drive area: Moody, Roop, Shorts, Wampler, Wayland, White halls
- Other locations: McGraw-Long, Shenandoah, Spotswood halls

### **Student Services (6)**
- Taylor Hall/The Union (TAYL) - Student union and services
- Warren Hall/The Union (WARR) - Student union building
- University Health Center (HCTR) - Student health services
- Student Success Center (SSC) - Academic support services
- University Services Building (USB) - Administrative services
- Frye Building (FRYE) - Administrative and support services

### **Arts & Performance (5)**
- Memorial Hall Arts Complex (MHAC) - Arts complex
- Music Building (MUS) - Music practice and performance
- Roberts Center for Music Performance (MRH) - Music venue
- Studio Center (SC) - Art studios and creative spaces
- Memorial Hall Greenhouse (MHGH) - Greenhouse facility

### **Support & Other Buildings (19)**
- Dining facilities (7): Mr. Chips, dining warehouses, concession buildings
- Support buildings (11): Power plant, motor pool, telecom, storage facilities
- Parking (1): Warsaw Ave. 5-level parking deck

## Example Recommendation Logic

For a user going to "Wilson Hall":

1. **Calculate distances** to all parking spots
2. **Check live data** for parking decks:
   - Ballard Deck: 1200 ft, 1442 spaces available ✅
   - Grace Deck: 800 ft, 399 spaces available ✅
   - Regular lot: 600 ft, no live data ❌

3. **Apply prioritization**:
   - Grace Deck ranks #1 (closest with live data)
   - Ballard Deck ranks #2 (more spaces, slightly farther)
   - Regular lot ranks #3 (closest but no live data)

This ensures users get the most reliable and convenient parking recommendations!

## Enhanced Search Features

### **Multi-Field Search**
Users can now search by:
- **Building Name**: "Wilson Hall", "UREC", "Carrier Library"
- **Building Code**: "WH", "ISAT", "FC", "UREC"
- **Category**: "Academic", "Recreation", "Dining", "Residence"
- **Department**: "Biology", "Music", "Athletics", "Dining Services"
- **Description**: "library", "fitness", "swimming", "performance"

### **Smart Suggestions**
- Shows **building codes** in blue badges (e.g., "WH", "ISAT")
- Displays **primary departments** for context
- **Category tags** for easy identification
- **Top 10 matches** to avoid overwhelming users

### **Example Searches**
- "ISAT" → Shows ISAT/CS Building with technology departments
- "UREC" → Shows University Recreation Center with fitness facilities
- "music" → Shows Music Building, Roberts Center for Music Performance
- "residence" or "dorm" → Shows all 23 residence halls
- "library" → Shows Carrier Library, Rose Library
- "Bluestone Drive" → Shows buildings on Bluestone Drive by address
- "SHOW" → Shows Showker Hall (business building) by building code
- "recreation" → Shows UREC, Godwin Hall, Convocation Center, etc.

## Technical Improvements

### **Data Structure**
Each building now includes official JMU data:
```json
{
  "name": "Wilson Hall",
  "category": "Academic",
  "coordinates": [-78.8691, 38.4367],
  "description": "Main administration building",
  "buildingCode": "WILS",
  "address": "951 Madison Drive",
  "departments": ["Administration", "President's Office", "Provost"]
}
```

### **Search Algorithm**
1. **Building name search** - Primary search method (e.g., "Wilson Hall", "UREC")
2. **Building code search** - Quick lookup using official codes (e.g., "WILS", "ISAT", "HART")
3. **Address search** - Find buildings by street address (e.g., "Carrier Drive", "Bluestone Drive")
4. **Case-insensitive** matching across all search types
5. **Simplified results** showing only building name, official code, and address
