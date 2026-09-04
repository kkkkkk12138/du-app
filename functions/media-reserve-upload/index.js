const {randomUUID} = require('crypto');

const {createMediaReservationHandler} = require('./handler');
const {createRuntimeDependencies} = require('./runtime');

function createMain({cloudbase, randomUUID: createId = randomUUID}) {
  const app = cloudbase.init({env: cloudbase.SYMBOL_CURRENT_ENV});
  return createMediaReservationHandler(
    createRuntimeDependencies({
      app,
      randomUUID: createId,
    }),
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
  main,
};
