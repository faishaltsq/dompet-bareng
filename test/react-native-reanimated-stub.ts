// Stand-in for react-native-reanimated in unit tests
const createAnimMock = () => {
  const chain: any = {
    duration: () => chain,
    delay: () => chain,
    springify: () => chain,
    damping: () => chain,
    stiffness: () => chain,
  };
  return chain;
};

export const useSharedValue = (initial: any) => ({ value: initial });
export const useAnimatedStyle = (fn: any) => {
  try {
    return fn() || {};
  } catch {
    return {};
  }
};
export const useReducedMotion = () => false;
export const withTiming = (toValue: any, _config?: any, callback?: any) => {
  if (callback) callback();
  return toValue;
};
export const withSpring = (toValue: any, _config?: any, callback?: any) => {
  if (callback) callback();
  return toValue;
};
export const withSequence = (...args: any[]) => args[args.length - 1];
export const withDelay = (_delay: number, toValue: any) => toValue;

export const FadeIn = createAnimMock();
export const FadeInDown = createAnimMock();
export const FadeInUp = createAnimMock();
export const FadeInLeft = createAnimMock();
export const FadeInRight = createAnimMock();
export const FadeOut = createAnimMock();
export const SlideInDown = createAnimMock();
export const SlideInUp = createAnimMock();
export const ZoomIn = createAnimMock();
export const Layout = createAnimMock();
export const LinearTransition = createAnimMock();

export const Easing = {
  out: (fn: any) => fn,
  cubic: (t: any) => t,
  linear: (t: any) => t,
  quad: (t: any) => t,
};

const Animated = {
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
};

export default Animated;
