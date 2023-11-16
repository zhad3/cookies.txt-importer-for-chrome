function i18n(message) {
    return chrome.i18n.getMessage(message);
}

function getParentByClassName(elem, className) {
    while (elem.parentNode && elem.className.split(' ').indexOf(className) == -1) {
        return getParentByClassName(elem.parentNode, className);
    }
    if (elem.className.split(' ').indexOf(className) >= 0) {
        return elem;
    } else {
        return undefined;
    }
}

function toggleDropdown(e) {
    e.preventDefault();
    const classes = e.currentTarget.parentNode.className.split(' ');
    const idx = classes.indexOf('close');
    if (idx != -1) {
        classes[idx] = 'open';
    } else {
        classes[classes.indexOf('open')] = 'close';
    }
    e.currentTarget.parentNode.className = classes.join(' ');
}

function selectStorage(storage_id) {
    const container = document.getElementById('storage-container');
    container.setAttribute('data-storage', storage_id);
    for (let c = 0; c < container.children.length; c++) {
        const child = container.children[c];
        if (child.getAttribute('data-id') == storage_id) {
            child.getElementsByClassName('inner')[0].className = 'inner selected';
        } else {
            child.getElementsByClassName('inner')[0].className = 'inner';
        }
    }
}

function setStorageData(e) {
    e.preventDefault();
    const storage_div = getParentByClassName(e.currentTarget, 'message');
    selectStorage(storage_div.getAttribute('data-id'));
}

function isParsing(on) {
    if (on) {
        document.getElementById('dnd').removeEventListener('dragover', dndOver);
        document.getElementById('dnd').removeEventListener('drop', dndDrop);
        document.getElementById('dnd_parsing').style.display = 'block';
        document.getElementById('dnd_ready').style.display = 'none';
    } else {
        document.getElementById('files').value = '';
        document.getElementById('dnd_parsing').style.display = 'none';
        document.getElementById('dnd_ready').style.display = 'block';
        document.getElementById('dnd').addEventListener('dragover', dndOver);
        document.getElementById('dnd').addEventListener('drop', dndDrop);
    }
}

const CookieFile = function(filename, isCookieStorage=false) {
    this.filename = filename;
    this.cookies = [];
    this.numfail = 0;
    this.isCookieStorage = isCookieStorage;
    this.div = document.createElement('div');
    this.div.className = 'message warn close';

    if (isCookieStorage) {
        const checkbox = document.createElement('div');
        const checkbox_inner = document.createElement('div');
        checkbox.className = 'checkbox';
        checkbox_inner.className = 'inner';
        checkbox_inner.addEventListener('click', setStorageData);
        checkbox.appendChild(checkbox_inner);
        this.div.appendChild(checkbox);
    }

    const title = document.createElement('span');
    title.className = 'title';
    title.appendChild(document.createTextNode(this.filename));

    title.addEventListener('click', toggleDropdown, false);
    this.div.appendChild(title);

    const cookielist = document.createElement('ul');
    if (this.isCookieStorage) {
        cookielist.className = "no-icon";
    }
    this.div.appendChild(cookielist);
};
CookieFile.prototype.addCookie = function(cookie,err=false) {
    cookie.error = err;
    if (err == true) {
        this.numfail++;
    }

    this.cookies.push(cookie);

    const cookielist = this.div.getElementsByTagName('ul')[0];
    const cookieitem = document.createElement('li');
    if (!this.isCookieStorage) {
        cookieitem.className = cookie.error ? 'error' : 'success';
    }
    const domain = document.createElement('span');
    domain.className = 'domain';
    if (cookie.error2 != undefined) {
        domain.title = cookie.error2;
    }
    if (!this.isCookieStorage) {
        domain.appendChild(document.createTextNode(cookie.domain));
    } else if (cookie.domain && cookie.domain.substr(0,9) != 'chrome://' && cookie.domain.substr(0,19) != 'chrome-extension://') {
        const favicon = document.createElement('img');
        favicon.src = cookie.domain;
        cookieitem.appendChild(favicon);
    }
    cookieitem.appendChild(document.createTextNode(cookie.name));
    cookieitem.appendChild(domain);

    cookielist.appendChild(cookieitem);
};
CookieFile.prototype.render = function() {
    let cstatus = 'success';
    if (this.numfail == this.cookies.length) {
        cstatus = 'error';
    } else if (this.numfail > 0) {
        cstatus = 'warn';
    }
    this.div.getElementsByClassName('title')[0].childNodes[0].data = this.filename + ' (' + (this.cookies.length - this.numfail) + '/' + this.cookies.length + ')';
    this.div.className = 'message '+cstatus+' close';
};
CookieFile.prototype.update = function(text) {
    this.div.getElementsByClassName('title')[0].childNodes[0].data = text;
};

function setCookie(line, cookie_file, cookie_obj, callback) {
    chrome.cookies.set(cookie_obj, function(cookie) {
        if (cookie == null || chrome.runtime.lastError != undefined) {
            cookie_file.addCookie({'name':i18n('error')+': chrome.cookies.set','domain':i18n('line')+' '+(line+1),'error2':(chrome.runtime.lastError)?chrome.runtime.lastError.message:undefined}, true);
        } else {
            cookie_file.addCookie(cookie);
        }

        callback();
    });
}

function importCookies(files) {
    const dnd = document.getElementById('dnd');
    const message = document.getElementById('message-container');
    let parsed_files = 0;
    const storage_id = document.getElementById('storage-container').getAttribute('data-storage');
    message.style.display='block';
    isParsing(true);

    const doneParsingAllFiles = () => {
        isParsing(false);
        // Since the popup closes after losing window focus
        // we save the latest loading status to give the user
        // a chance to inspect potential errors
        chrome.storage.local.set({
            'last_import':document.getElementById('message-container').innerHTML,
            'last_import_time':Math.floor(Date.now() / 1000)
        });
    };

    for (let i = 0, f; f = files[i]; i++) {
        if (f.size > 1024 * 100) {
            const cookie_file = new CookieFile(f.name);
            cookie_file.addCookie({'name':i18n('error')+': '+i18n('errorFilesize'), 'domain':''}, true);
            message.appendChild(cookie_file.div);
            cookie_file.render();
            parsed_files++;
            continue;
        }

        const reader = new FileReader();
        reader.onload = (function(file) {
            const cookie_file = new CookieFile(file.name);
            let parsed_lines = 0;
            message.appendChild(cookie_file.div);
            return function(e) {
                const lines = e.target.result.split(/[\r\n]+/g);
                if (lines.length == 1 && lines[0] == '') {
                    cookie_file.addCookie({'name':i18n('error')+': '+i18n('errorEmpty'), 'domain':''}, true);
                    lines = []; // Skip line parsing, this will also make lines.length == 0 for the finish check
                }
                for (let a = 0; a < lines.length; a++) {
                    const httpOnly = lines[a].startsWith('#HttpOnly_');
                    const l = lines[a].replace('#HttpOnly_','');
                    // Line is a comment or empty
                    if ((l.length > 0 && l.charAt(0) == '#') || l.length == 0) {
                        parsed_lines++;
                        cookie_file.update('(' + parsed_lines + '/' + lines.length + ')');
                        continue;
                    }
                    const fields = l.split('\t');
                    // Netscape format always has 7 fields
                    if (fields.length != 7) {
                        parsed_lines++;
                        cookie_file.addCookie({'name':i18n('error')+': '+i18n('errorSyntax'),'domain':i18n('line')+' '+(a+1)}, true);
                        cookie_file.update('(' + parsed_lines + '/' + lines.length + ')');
                        continue;
                    }
                    const url = 'http'+(fields[3]=='TRUE'?'s':'')+'://' + fields[0].replace(/^\./,'') + fields[2];
                    const cookie_obj = {
                        'url': url,
                        'name': fields[5],
                        'value': fields[6],
                        'domain': fields[0],
                        'path': fields[2],
                        'secure': fields[3]=='TRUE'?true:false,
                        'httpOnly': httpOnly
                    };
                    if (parseInt(fields[4]) > 0) {
                        cookie_obj.expirationDate = parseInt(fields[4]);
                    }
                    if (storage_id) {
                        cookie_obj.storeId = storage_id;
                    }

                    setCookie(a, cookie_file, cookie_obj, function() {
                        parsed_lines++;

                        cookie_file.update('(' + parsed_lines + '/' + lines.length + ')');

                        // Finished all line parsing
                        if (parsed_lines == lines.length) {
                            cookie_file.render();
                            parsed_files++;
                        }
                        if (parsed_files == files.length) {
                            doneParsingAllFiles();
                        }
                    });
                }
                // Finished all line parsing
                if (parsed_lines == lines.length) {
                    cookie_file.render();
                    parsed_files++;
                }
                if (parsed_files == files.length) {
                    doneParsingAllFiles();
                }
            };
        })(f);

        reader.readAsText(f);
    }

    if (parsed_files == files.length) {
        doneParsingAllFiles();
    }
}

function fileSelect(e) {
    e.stopPropagation();
    e.preventDefault();
    importCookies(e.target.files);
}

function open_file_dialog(e) {
    document.getElementById('files').click();
}

function dndOver(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function dndDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    importCookies(e.dataTransfer.files);
}

function parseTabs(store, referer_id=null, callback) {
    const storage_list = new CookieFile('Cookie storage #'+store.id, true);
    storage_list.div.setAttribute('data-id', store.id);
    document.getElementById('storage-container').appendChild(storage_list.div);
    for (let t = 0; t < store.tabIds.length; t++) {
        chrome.tabs.get(store.tabIds[t], function(tab) {
            if (referer_id && tab.id == referer_id) {
                selectStorage(store.id);
            }
            storage_list.addCookie({'name':tab.title, 'domain':tab.favIconUrl});
            callback();
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({'currentWindow':true, 'active':true}, function(tab) {
        let referer_id = null;
        if (!chrome.runtime.lastError && tab && tab instanceof Array && tab.length > 0) {
            referer_id = tab[0].id;
        }
        chrome.cookies.getAllCookieStores(function(stores) {
            let parsed_stores = 0;
            for (let i = 0; i < stores.length; i++) {
                parseTabs(stores[i], referer_id, function() {
                    parsed_stores++;
                    // Referer was undefined, select first storage
                    if(parsed_stores == stores.length && document.getElementById('storage-container').getAttribute('data-storage') == undefined) {
                        selectStorage(stores[0].id);
                    }
                });
            }
        });
    });

    const dnd_parsing = document.getElementById('dnd_parsing');
    const dnd_ready = document.getElementById('dnd_ready');
    dnd_parsing.innerHTML = i18n('htmlParsingMessage');
    dnd_ready.innerHTML = '';
    dnd_ready.appendChild(document.createTextNode(i18n('htmlReadyMessage')));
    const manual_link = document.createElement('a');
    manual_link.href = '#';
    manual_link.addEventListener('click', open_file_dialog);
    manual_link.appendChild(document.createTextNode(i18n('htmlSelectManually')));
    dnd_ready.appendChild(manual_link);

    document.getElementById('files').addEventListener('change', fileSelect);
    const dnd = document.getElementById("dnd");
    dnd.addEventListener('dragover', dndOver);
    dnd.addEventListener('drop', dndDrop);

    document.getElementById('last-imported-label').innerText = i18n('lastImportLabel');

    // Load last import if it exist
    chrome.storage.local.get(["last_import_time", "last_import"], function(data) {
        const messageContainer = document.getElementById('message-container-last');
        if (data && data.last_import_time) {
            const now = Math.floor(Date.now() / 1000);
            // If data is older than 10 minutes we clear it out
            if (data.last_import_time + (60 * 10) < now) {
                chrome.storage.local.clear();
            } else if (data.last_import) {
                messageContainer.innerHTML = data.last_import;
                const files = messageContainer.getElementsByClassName('title');
                for (let i = 0; i < files.length; ++i) {
                    files[i].addEventListener('click', toggleDropdown);
                }
            } else {
                messageContainer.innerHTML = i18n('lastImportEmpty');
            }
        } else {
            messageContainer.innerHTML = i18n('lastImportEmpty');
        }
    });
});

