/* eslint-env jest */
/* global jest */
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mock = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'default') return View;
        if (typeof prop === 'string') {
          return React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
        }
        return undefined;
      },
    },
  );
  return mock;
});

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { value?: string }) => React.createElement(View, { testID: 'qr-code' }),
  };
});