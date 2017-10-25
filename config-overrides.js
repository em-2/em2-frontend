const CloneDeep = require('lodash/cloneDeep')

module.exports = function override(config, env) {
  // Add worker-loader by hijacking configuration for regular .js files.

  const worker_ext = /\.worker\.js$/

  const babelLoader = config.module.rules[1].oneOf.find(
    rule => rule.loader && rule.loader.indexOf('babel-loader') !== -1
  );

  const workerLoader = CloneDeep(babelLoader)

  workerLoader.test = worker_ext
  workerLoader.use = [
    'worker-loader',
    { // Old babel-loader configuration goes here.
      loader: workerLoader.loader,
      options: workerLoader.options,
    },
  ];
  delete workerLoader.loader
  delete workerLoader.options

  babelLoader.exclude = (babelLoader.exclude || []).concat([worker_ext])

  config.module.rules.push(workerLoader)

  // console.dir(config, { depth: 10, colors: true })

  return config
}
