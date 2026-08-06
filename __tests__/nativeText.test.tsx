import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Platform, StyleSheet, Text, TextInput} from 'react-native';

import {AppText} from '../src/components/AppText';
import {configureNativeText} from '../src/platform/configureNativeText';

describe('native text defaults', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalOS,
    });
  });

  test('normalizes Android text metrics across the app', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });

    configureNativeText();

    expect((Text as any).defaultProps).toMatchObject({
      allowFontScaling: false,
      android_hyphenationFrequency: 'none',
      includeFontPadding: false,
      maxFontSizeMultiplier: 1,
      textBreakStrategy: 'simple',
    });
    expect((TextInput as any).defaultProps).toMatchObject({
      allowFontScaling: false,
      includeFontPadding: false,
      maxFontSizeMultiplier: 1,
    });
  });

  test('applies Android line measurement rules even with screen styles', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AppText style={{fontSize: 10}}>日迹</AppText>,
      );
    });
    const text = renderer!.root.findByType(Text);

    expect(text.props).toMatchObject({
      allowFontScaling: false,
      android_hyphenationFrequency: 'none',
      maxFontSizeMultiplier: 1,
      textBreakStrategy: 'simple',
    });
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({
      fontSize: 10,
      includeFontPadding: false,
    });
  });
});
