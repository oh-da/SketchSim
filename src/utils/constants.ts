// Spatial scale
export const DEFAULT_SCALE = 0.5; // meters per pixel

// Snap thresholds (px)
export const AUTO_SNAP_DISTANCE = 10;
export const SUGGEST_SNAP_DISTANCE = 20;
export const INTERSECTION_TOLERANCE = 5;
export const TEXT_ASSOCIATION_RADIUS = 40;
export const SIGNAL_ASSOCIATION_RADIUS = 30;
export const MIN_SEGMENT_LENGTH = 30;

// Demand defaults
export const DEFAULT_DEMAND = 100; // veh/hr
export const DEFAULT_CYCLE_TIME = 60; // seconds
export const DEFAULT_FREE_FLOW_SPEED = 13.9; // m/s (50 km/h)

// Vehicle / IDM parameters
export const VEHICLE_LENGTH = 4.5; // meters
export const IDM_MAX_ACCEL = 1.5; // m/s²
export const IDM_COMFORT_DECEL = 2.5; // m/s²
export const IDM_MIN_GAP = 2.0; // meters
export const IDM_DESIRED_HEADWAY = 1.0; // seconds
export const SPEED_NOISE_RANGE = 0.1; // fraction (±10%)

// Intersection control
export const CRITICAL_GAP = 2.5; // seconds
export const MAX_WAIT_TIME = 8.0; // seconds

// Turning ratios
export const TURN_RATIO_STRAIGHT = 0.60;
export const TURN_RATIO_RIGHT = 0.25;
export const TURN_RATIO_LEFT = 0.15;
export const STRAIGHT_ANGLE_THRESHOLD = 30; // degrees
export const UTURN_ANGLE_THRESHOLD = 150; // degrees
export const MAJOR_ROAD_ANGLE_THRESHOLD = 30; // degrees

// UI / timing
export const INTERPRETER_DEBOUNCE = 200; // ms
export const METRICS_FLOW_WINDOW = 60; // seconds
export const QUEUE_SPEED_THRESHOLD = 0.5; // m/s
export const QUEUE_BADGE_MIN = 3; // vehicles
export const LANE_OFFSET = 3; // px
export const TOAST_DURATION = 4000; // ms
