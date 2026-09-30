export function requestExtensionReload(sendReloadRequest, reloadPage) {
  try {
    void Promise.resolve(sendReloadRequest()).catch(() => {});
  } finally {
    reloadPage();
  }
}
