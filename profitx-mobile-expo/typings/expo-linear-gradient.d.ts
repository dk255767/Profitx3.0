declare module 'expo-linear-gradient' {
  import { ComponentType } from 'react';
  import { ViewProps } from 'react-native';

  export const LinearGradient: ComponentType<ViewProps & { colors?: string[] }>;
  export default LinearGradient;
}
