chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.query({'currentWindow':true, 'active':true}, function(tab) {
        chrome.storage.local.set({'referer_tab':tab[0]}, function() {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage(function(err) {
                    if (chrome.runtime.lastError != undefined) {
                        window.open(chrome.runtime.getURL('options.html'));
                    }
                });
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    });
});
