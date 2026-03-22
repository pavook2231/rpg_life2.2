const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const realProjectRoot = fs.realpathSync(projectRoot);
const config = getDefaultConfig(projectRoot);

const watchFolders = new Set(config.watchFolders ?? []);
watchFolders.add(projectRoot);
watchFolders.add(realProjectRoot);
watchFolders.add(path.join(projectRoot, 'node_modules'));
watchFolders.add(path.join(realProjectRoot, 'node_modules'));

config.watchFolders = Array.from(watchFolders);
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
};

module.exports = config;
