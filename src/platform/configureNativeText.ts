import {Platform, Text, TextInput} from 'react-native';

type ComponentWithDefaults = {
  defaultProps?: Record<string, unknown>;
};

function mergeDefaults(
  component: ComponentWithDefaults,
  defaults: Record<string, unknown>,
) {
  component.defaultProps = {
    ...component.defaultProps,
    ...defaults,
  };
}

export function configureNativeText() {
  if (Platform.OS !== 'android') {
    return;
  }

  const androidDefaults = {
    allowFontScaling: false,
    maxFontSizeMultiplier: 1,
  };

  mergeDefaults(Text as unknown as ComponentWithDefaults, {
    ...androidDefaults,
    android_hyphenationFrequency: 'none',
    includeFontPadding: false,
    textBreakStrategy: 'simple',
  });
  mergeDefaults(TextInput as unknown as ComponentWithDefaults, {
    ...androidDefaults,
    includeFontPadding: false,
  });
}
