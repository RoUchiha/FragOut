const {getAdMobConfig} = require('./admob.config.cjs');

const {android, ios} = getAdMobConfig(process.env);

module.exports = {
  dependencies: {
    'react-native-google-mobile-ads': {
      platforms: {
        ...(android ? {} : {android: null}),
        ...(ios ? {} : {ios: null}),
      },
    },
  },
};
