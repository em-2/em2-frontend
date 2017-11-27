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
    'worker-loader',  // sting is equivalent of {loader: 'worker-loader'}
  ]
  // chrome works fine with non babel version we do this to get proper traces
  // TODO might need to remove this if a js feature is used that doesn't work with chrome
  if (env !== 'development') {
    workerLoader.use.push(
      {
        loader: workerLoader.loader,
        options: workerLoader.options,
      }
    )
  }
  delete workerLoader.loader
  delete workerLoader.options

  babelLoader.exclude = (babelLoader.exclude || []).concat([worker_ext])

  config.module.rules.push(workerLoader)

  // console.dir(config, { depth: 10, colors: true })

  return config
}
