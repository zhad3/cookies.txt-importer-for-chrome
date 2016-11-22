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
    var classes = e.currentTarget.parentNode.className.split(' ');
    var idx = classes.indexOf('close');
    if (idx != -1) {
        classes[idx] = 'open';
    } else {
        classes[classes.indexOf('open')] = 'close';
    }
    e.currentTarget.parentNode.className = classes.join(' ');
}

function selectStorage(storage_id) {
    var container = document.getElementById('storage-container');
    container.setAttribute('data-storage', storage_id);
    for (var c = 0; c < container.children.length; c++) {
        var child = container.children[c];
        if (child.getAttribute('data-id') == storage_id) {
            child.getElementsByClassName('inner')[0].className = 'inner selected';
        } else {
            child.getElementsByClassName('inner')[0].className = 'inner';
        }
    }
}

function setStorageData(e) {
    e.preventDefault();
    var storage_div = getParentByClassName(e.currentTarget, 'message');
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

var CookieFile = function(filename, isCookieStorage=false) {
    this.filename = filename;
    this.cookies = [];
    this.numfail = 0;
    this.isCookieStorage = isCookieStorage;
    this.div = document.createElement('div');
    this.div.className = 'message warn close';

    if (isCookieStorage) {
        var checkbox = document.createElement('div');
        var checkbox_inner = document.createElement('div');
        checkbox.className = 'checkbox';
        checkbox_inner.className = 'inner';
        checkbox_inner.addEventListener('click', setStorageData);
        checkbox.appendChild(checkbox_inner);
        this.div.appendChild(checkbox);
    }

    var title = document.createElement('span');
    title.className = 'title';
    title.appendChild(document.createTextNode(this.filename));

    title.addEventListener('click', toggleDropdown, false);
    this.div.appendChild(title);

    var cookielist = document.createElement('ul');
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

    var cookielist = this.div.getElementsByTagName('ul')[0];
    var cookieitem = document.createElement('li');
    if (!this.isCookieStorage) {
        cookieitem.className = cookie.error ? 'error' : 'success';
    }
    var domain = document.createElement('span');
    domain.className = 'domain';
    if (cookie.error2 != undefined) {
        domain.title = cookie.error2;
    }
    if (!this.isCookieStorage) {
        domain.appendChild(document.createTextNode(cookie.domain));
    } else if (cookie.domain && cookie.domain.substr(0,9) != 'chrome://' && cookie.domain.substr(0,19) != 'chrome-extension://') {
        var favicon = document.createElement('img');
        favicon.src = cookie.domain;
        cookieitem.appendChild(favicon);
    }
    cookieitem.appendChild(document.createTextNode(cookie.name));
    cookieitem.appendChild(domain);

    cookielist.appendChild(cookieitem);
};
CookieFile.prototype.render = function() {
    var cstatus = 'success';
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
    var dnd = document.getElementById('dnd');
    var message = document.getElementById('message-container');
    var parsed_files = 0;
    var storage_id = document.getElementById('storage-container').getAttribute('data-storage');
    message.style.display='block';
    isParsing(true);
    for (var i = 0, f; f = files[i]; i++) {
        if (f.size > 1024 * 100) {
            var cookie_file = new CookieFile(f.name);
            cookie_file.addCookie({'name':i18n('error')+': '+i18n('errorFilesize'), 'domain':''}, true);
            message.appendChild(cookie_file.div);
            cookie_file.render();
            parsed_files++;
            continue;
        }

        var reader = new FileReader();
        reader.onload = (function(file) {
            var cookie_file = new CookieFile(file.name);
            var parsed_lines = 0;
            message.appendChild(cookie_file.div);
            return function(e) {
                var lines = e.target.result.split(/[\r\n]+/g);
                if (lines.length == 1 && lines[0] == '') {
                    cookie_file.addCookie({'name':i18n('error')+': '+i18n('errorEmpty'), 'domain':''}, true);
                    lines = []; // Skip line parsing, this will also make lines.length == 0 for the finish check
                }
                for (var a = 0; a < lines.length; a++) {
                    var l = lines[a];
                    // Line is a comment or empty
                    if ((l.length > 0 && l.charAt(0) == '#') || l.length == 0) {
                        parsed_lines++;
                        cookie_file.update('(' + parsed_lines + '/' + lines.length + ')');
                        continue;
                    }
                    var fields = l.split('\t');
                    // Netscape format always has 7 fields
                    if (fields.length != 7) {
                        parsed_lines++;
                        cookie_file.addCookie({'name':i18n('error')+': '+i18n('errorSyntax'),'domain':i18n('line')+' '+(a+1)}, true);
                        cookie_file.update('(' + parsed_lines + '/' + lines.length + ')');
                        continue;
                    }
                    var url = 'http'+(fields[3]=='TRUE'?'s':'')+'://' + fields[0].replace(/^\./,'') + fields[2];
                    var cookie_obj = {
                        'url': url,
                        'name': fields[5],
                        'value': fields[6],
                        'domain': fields[0],
                        'path': fields[2],
                        'secure': fields[3]=='TRUE'?true:false
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
                            isParsing(false);
                        }   
                    });
                    
                }
                // Finished all line parsing
                if (parsed_lines == lines.length) {
                    cookie_file.render();
                    parsed_files++;
                }
                if (parsed_files == files.length) {
                    isParsing(false);
                }
            };
        })(f);

        reader.readAsText(f);
    }

    if (parsed_files == files.length) {
        isParsing(false);
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
    var storage_list = new CookieFile('Cookie storage #'+store.id, true);
    storage_list.div.setAttribute('data-id', store.id);
    document.getElementById('storage-container').appendChild(storage_list.div);
    for (var t = 0; t < store.tabIds.length; t++) {
        chrome.tabs.get(store.tabIds[t], function(tab) {
            if (referer_id && tab.id == referer_id) {
                selectStorage(store.id);
            }
            storage_list.addCookie({'name':tab.title, 'domain':tab.favIconUrl});
            callback();
        });
    }
}

function closeWindow(e) {
    e.preventDefault();
    chrome.tabs.query({'currentWindow':true, 'active':true}, function(tab) {
        if (tab && !chrome.runtime.error) {
            chrome.tabs.remove(tab[0].id, function() {});
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get('referer_tab', function(obj) {
        var referer_id = null;
        if (!chrome.runtime.lastError && obj.referer_tab) {
            referer_id = obj.referer_tab.id;
        }
        chrome.cookies.getAllCookieStores(function(stores) {
            var parsed_stores = 0;
            for (var i = 0; i < stores.length; i++) {
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
    
    var dnd_parsing = document.getElementById('dnd_parsing');
    var dnd_ready = document.getElementById('dnd_ready');
    dnd_parsing.innerHTML = i18n('htmlParsingMessage');
    dnd_ready.innerHTML = '';
    dnd_ready.appendChild(document.createTextNode(i18n('htmlReadyMessage')));
    var manual_link = document.createElement('a');
    manual_link.href = '#';
    manual_link.addEventListener('click', open_file_dialog);
    manual_link.appendChild(document.createTextNode(i18n('htmlSelectManually')));
    dnd_ready.appendChild(manual_link);

    document.getElementById('files').addEventListener('change', fileSelect);
    var dnd = document.getElementById("dnd");
    dnd.addEventListener('dragover', dndOver);
    dnd.addEventListener('drop', dndDrop);

    var closeBtn = document.getElementById('close-btn');
    closeBtn.addEventListener('click', closeWindow);
    closeBtn.innerHTML = i18n('closeButton');
});
