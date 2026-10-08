// Gesture-handler's native module is absent under Jest: detectors render their child, roots
// render a plain View and gesture builders accept any chained call.
const React = require("react");
const { View } = require("react-native");

const chainable = new Proxy({}, { get: () => () => chainable });

module.exports = {
  Gesture: new Proxy({}, { get: () => () => chainable }),
  GestureDetector: ({ children }) => children,
  GestureHandlerRootView: (props) => React.createElement(View, props),
};
