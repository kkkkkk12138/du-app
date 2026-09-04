const {createMediaUploadTicketHandler} = require('./handler');
const {createRuntimeDependencies} = require('./runtime');

function createMain({cloudbase, COS, env}) {
  const app = cloudbase.init({env: cloudbase.SYMBOL_CURRENT_ENV});
  const dependencies = createRuntimeDependencies({
    app,
    createCosClient: credentials => new COS(credentials),
    env,
  });
  return createMediaUploadTicketHandler(dependencies);
}

let runtimeHandler;

async function main(event, context) {
  if (!runtimeHandler) {
    const cloudbase = require('@cloudbase/node-sdk');
    const COS = require('cos-nodejs-sdk-v5');
    runtimeHandler = createMain({
      cloudbase,
      COS,
      env: process.env,
    });
  }
  return runtimeHandler(event, context);
}

module.exports = {
  createMain,
  main,
};
