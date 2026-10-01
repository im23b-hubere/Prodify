const { Image, Text, View } = require("react-native");

const identity = (value) => value;
const enter = {
  duration: () => enter,
  delay: () => enter,
  springify: () => enter,
  damping: () => enter,
  easing: () => enter,
};

module.exports = {
  __esModule: true,
  default: { View, Image, Text, createAnimatedComponent: identity },
  View,
  Image,
  Text,
  FadeIn: enter,
  FadeOut: enter,
  FadeInUp: enter,
  FadeInDown: enter,
  FadeInLeft: enter,
  FadeInRight: enter,
  ZoomIn: enter,
  SlideInDown: enter,
  SlideOutDown: enter,
  useSharedValue: (initial) => {
    const shared = { value: initial };
    shared.get = () => shared.value;
    shared.set = (next) => {
      shared.value = typeof next === "function" ? next(shared.value) : next;
    };
    return shared;
  },
  useAnimatedStyle: (fn) => fn(),
  useAnimatedProps: (fn) => fn(),
  useReducedMotion: () => false,
  withRepeat: identity,
  withTiming: identity,
  withSpring: identity,
  withDecay: () => 0,
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
  withSequence: identity,
  withDelay: (_delay, value) => value,
  runOnJS: identity,
  runOnUI: identity,
  createAnimatedComponent: identity,
  Easing: {
    inOut: identity,
    in: identity,
    out: identity,
    ease: identity,
    linear: identity,
    cubic: identity,
    quad: identity,
    bezier: () => identity,
  },
  cubicBezier: () => "ease-out",
  interpolate: () => 0,
  interpolateColor: (_value, _input, output) => output[0],
  Extrapolation: { CLAMP: "clamp" },
};
