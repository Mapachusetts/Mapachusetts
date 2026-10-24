// data/us-states.js
// All 50 U.S. states + DC so the "State" dropdown and the country-level globe
// markers are complete from day one. Centers are approximate (used for the
// camera and marker placement only).
//
// Row format: [USPS code, name, lng, lat]

export const US_STATES = [
  ["AL", "Alabama", -86.8, 32.8],
  ["AK", "Alaska", -150.0, 64.0],
  ["AZ", "Arizona", -111.7, 34.3],
  ["AR", "Arkansas", -92.4, 34.9],
  ["CA", "California", -119.4, 36.7],
  ["CO", "Colorado", -105.5, 39.0],
  ["CT", "Connecticut", -72.7, 41.6],
  ["DE", "Delaware", -75.5, 39.0],
  ["DC", "District of Columbia", -77.03, 38.9],
  ["FL", "Florida", -81.7, 28.1],
  ["GA", "Georgia", -83.4, 32.7],
  ["HI", "Hawaii", -157.5, 20.5],
  ["ID", "Idaho", -114.6, 44.4],
  ["IL", "Illinois", -89.2, 40.0],
  ["IN", "Indiana", -86.3, 39.9],
  ["IA", "Iowa", -93.5, 42.0],
  ["KS", "Kansas", -98.4, 38.5],
  ["KY", "Kentucky", -85.3, 37.5],
  ["LA", "Louisiana", -92.0, 31.0],
  ["ME", "Maine", -69.2, 45.3],
  ["MD", "Maryland", -76.8, 39.0],
  ["MA", "Massachusetts", -71.8, 42.2],
  ["MI", "Michigan", -84.7, 44.3],
  ["MN", "Minnesota", -94.3, 46.3],
  ["MS", "Mississippi", -89.7, 32.7],
  ["MO", "Missouri", -92.5, 38.4],
  ["MT", "Montana", -110.0, 47.0],
  ["NE", "Nebraska", -99.8, 41.5],
  ["NV", "Nevada", -116.6, 39.3],
  ["NH", "New Hampshire", -71.6, 43.7],
  ["NJ", "New Jersey", -74.5, 40.1],
  ["NM", "New Mexico", -106.1, 34.4],
  ["NY", "New York", -75.5, 42.9],
  ["NC", "North Carolina", -79.4, 35.6],
  ["ND", "North Dakota", -100.5, 47.5],
  ["OH", "Ohio", -82.8, 40.3],
  ["OK", "Oklahoma", -97.5, 35.6],
  ["OR", "Oregon", -120.5, 43.9],
  ["PA", "Pennsylvania", -77.8, 40.9],
  ["RI", "Rhode Island", -71.5, 41.7],
  ["SC", "South Carolina", -80.9, 33.9],
  ["SD", "South Dakota", -100.2, 44.4],
  ["TN", "Tennessee", -86.3, 35.9],
  ["TX", "Texas", -99.3, 31.5],
  ["UT", "Utah", -111.7, 39.3],
  ["VT", "Vermont", -72.7, 44.0],
  ["VA", "Virginia", -78.8, 37.5],
  ["WA", "Washington", -120.7, 47.4],
  ["WV", "West Virginia", -80.6, 38.6],
  ["WI", "Wisconsin", -89.8, 44.6],
  ["WY", "Wyoming", -107.5, 43.0],
];

// Camera zoom per state (default is the "state" level zoom). Big states sit
// further out, small ones further in, so each one roughly fills the view.
export const STATE_ZOOM = {
  AK: 3.5, TX: 5.1, CA: 5.3, MT: 5.7, NM: 5.9, NV: 5.8, FL: 5.7, MI: 5.7,
  MN: 5.8, ID: 5.6, WV: 6.8, NH: 6.9, VT: 7, MD: 7, NJ: 7, MA: 7.2,
  CT: 7.7, DE: 7.7, RI: 8.3, DC: 10,
};
