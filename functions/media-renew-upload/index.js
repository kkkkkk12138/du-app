const {createMediaRenewUploadHandler} = require('./handler');
const {createRuntimeDependencies} = require('./runtime');

function createMain({cloudbase}) {
  const app = cloudbase.init({env: cloudbase.SYMBOL_CURRENT_ENV});
  return createMediaRenewUploadHandler(
    createRuntimeDependencies({app}),
  );
}

let runtimeHandler;

async function main(event, context) {
  if (!runtimeHandler) {
    const cloudbase = require('@cloudbase/node-sdk');
    runtimeHandler = createMain({cloudbase});
  }
  return runtimeHandler(event, context);
}

module.exports = {
  createMain,
  createMediaRenewUploadHandler,
  createRuntimeDependencies,
  main,
};
