(function(){
    if(document.getElementById('pbs-main-panel')) return;

    var serverOffset = 0;
    var lastPlannedFireTime = null; // 計劃發射 server time
    var countdownTimer = null;

    // --- 1. LOG 面板 ---
    var logPanel = document.createElement('div');
    logPanel.id = 'pbs-log-panel';
    logPanel.style.cssText = 'position:fixed;bottom:20px;left:20px;width:380px;height:260px;overflow-y:auto;background:rgba(0,0,0,0.9);color:#fff;font-family:Consolas,monospace;font-size:12px;padding:10px;border:1px solid #555;border-radius:6px;z-index:999999;white-space:pre-wrap;box-shadow:0 4px 10px rgba(0,0,0,0.5);display:none;';
    document.body.appendChild(logPanel);

    function log(type, msg) {
        logPanel.style.display = 'block';
        var line = document.createElement('div');
        var color = '#fff';
        if(type === 'SUCCESS') color = '#00ff88';
        if(type === 'INFO')    color = '#00d0ff';
        if(type === 'WARNING') color = '#ffcc00';
        if(type === 'ERROR')   color = '#ff4444';
        if(type === 'GUARD')   color = '#00bfff';

        var nowForLog = new Date(Date.now() + serverOffset);
        var time = nowForLog.toLocaleTimeString('en-GB') + '.' + String(nowForLog.getMilliseconds()).padStart(3,'0');
        line.style.color = color;
        line.style.borderBottom = '1px solid #333';
        line.style.padding = '2px 0';
        line.innerText = '[' + time + '] [' + type + '] ' + msg;
        logPanel.appendChild(line);
        logPanel.scrollTop = logPanel.scrollHeight;
    }

    // --- 2. Guardian ---
    log('GUARD', 'Session Guardian V3.0 已啟動 (每4分鐘保活)');
    setInterval(function() {
        fetch(window.location.href, { method: 'HEAD' })
            .then(function(r) {
                if(r.ok) log('GUARD', '保活成功 (Session Active)');
                else     log('WARNING', '保活異常 Status: ' + r.status);
            })
            .catch(function(e) { log('ERROR', '保活網絡錯誤: ' + e); });
    }, 240000);

    // --- 3. 控制面板 ---
    var panel = document.createElement('div');
    panel.id = 'pbs-main-panel';
    panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:320px;background:rgba(20,20,20,0.95);color:#fff;z-index:999999;padding:15px;border-radius:8px;font-size:13px;border:1px solid #444;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:sans-serif;';

    panel.innerHTML = '\
        <h3 style="color:#fc0;margin:0 0 10px;border-bottom:1px solid #555;padding-bottom:5px;font-size:16px;font-weight:bold;display:flex;justify-content:space-between;">\
            <span>P-Bandai Sniper V7.3</span>\
            <span style="cursor:pointer;color:#999" onclick="document.getElementById(\\\'pbs-main-panel\\\').remove();document.getElementById(\\\'pbs-log-panel\\\').style.display=\\\'none\\\';">✕</span>\
        </h3>\
        <div style="margin-bottom:8px">\
            <label style="display:block;color:#ccc;font-size:11px">⏰ Time (HH:MM:SS)</label>\
            <input id="pbs-time" value="16:00:00" style="width:100%;padding:5px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;box-sizing:border-box;">\
        </div>\
        <div id="pbs-countdown" style="margin-bottom:4px;text-align:center;font-size:16px;color:#0fd;">--.-- s</div>\
        <div style="display:flex;gap:10px;margin-bottom:8px">\
            <div style="flex:1">\
                <label style="display:block;color:#ccc;font-size:11px">🔢 Qty</label>\
                <input id="pbs-qty" type="number" value="1" style="width:100%;padding:5px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;box-sizing:border-box;">\
            </div>\
            <div style="flex:1">\
                <label style="display:block;color:#ccc;font-size:11px">🕰️ Offset (ms)</label>\
                <input id="pbs-offset" type="number" value="0" placeholder="+/-" style="width:100%;padding:5px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;box-sizing:border-box;">\
            </div>\
        </div>\
        <div style="margin-bottom:10px">\
            <label style="display:block;color:#ccc;font-size:11px">📋 Paste Fetch</label>\
            <textarea id="pbs-fetch" rows="3" style="width:100%;padding:5px;background:#333;color:#aaa;border:1px solid #555;border-radius:4px;font-size:11px;resize:vertical;box-sizing:border-box;" placeholder="fetch(...)"></textarea>\
        </div>\
        <button id="pbs-btn" style="width:100%;padding:10px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px">🚀 Start</button>\
        <div id="pbs-status" style="margin-top:5px;text-align:center;color:#aaa;font-size:11px">Ready. <span style="color:#00bfff">🛡️Guardian ON</span></div>\
    ';
    document.body.appendChild(panel);

    var timeInput   = document.getElementById('pbs-time');
    var qtyInput    = document.getElementById('pbs-qty');
    var offsetInput = document.getElementById('pbs-offset');
    var fetchInput  = document.getElementById('pbs-fetch');
    var btn         = document.getElementById('pbs-btn');
    var status      = document.getElementById('pbs-status');
    var cdLabel     = document.getElementById('pbs-countdown');

    // --- Sync 按鈕 ---
    (function(){
        if (!timeInput) return;
        var syncBtn = document.createElement('button');
        syncBtn.id = 'pbs-sync';
        syncBtn.textContent = 'Sync';
        syncBtn.style.marginTop = '4px';
        syncBtn.style.padding = '4px 6px';
        syncBtn.style.fontSize = '11px';
        syncBtn.style.background = '#007bff';
        syncBtn.style.color = '#fff';
        syncBtn.style.border = 'none';
        syncBtn.style.borderRadius = '4px';
        syncBtn.style.cursor = 'pointer';
        timeInput.parentNode.appendChild(syncBtn);

        syncBtn.onclick = function () {
            log('INFO', '開始對錶 (向伺服器取時間)...');
            var t0 = Date.now();
            fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
                .then(function (r) {
                    var t1 = Date.now();
                    var dateHeader = r.headers.get('date');
                    if (!dateHeader) {
                        log('WARNING', '伺服器無 Date Header，用返本地時間');
                        serverOffset = 0;
                        return;
                    }
                    var serverTime = new Date(dateHeader).getTime();
                    var latency = (t1 - t0) / 2;
                    var adjustedServer = serverTime + latency;
                    serverOffset = adjustedServer - t1;
                    log('SUCCESS', '對錶完成，Server Offset: ' + serverOffset + 'ms');
                })
                .catch(function (e) {
                    log('ERROR', '對錶失敗，用本地時間: ' + e);
                    serverOffset = 0;
                });
        };
    })();

    // --- 自動抓 Product ID (原 7.2 寫法) ---
    var pid = null;
    try {
        var scripts = [].slice.call(document.querySelectorAll('script'));
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].textContent.includes('PRELOAD_DATA =')) {
                var jsonMatch = scripts[i].textContent.match(/PRELOAD_DATA\s*=\s*({.*?})\s*$/m);
                if (jsonMatch) {
                    var data = JSON.parse(jsonMatch[1]);
                    if(data.product && data.product.areaItemNos) {
                        pid = data.product.areaItemNos[0];
                        log('SUCCESS', '自動鎖定商品 ID: ' + pid);
                        status.innerHTML = 'Locked: ' + pid + ' <span style="color:#00bfff">🛡️Guardian ON</span>';
                        status.style.color = '#0f0';
                    }
                }
                break;
            }
        }
    } catch(e) {
        log('ERROR', '解析 ID 失敗: ' + e.message);
    }

    if(!pid) log('WARNING', '未找到商品 ID，請確認在商品詳情頁');

    // --- 倒數計時顯示 ---
    function startCountdown(targetTimeMs) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = setInterval(function(){
            var now = Date.now() + serverOffset;
            var diff = targetTimeMs - now;
            if (diff <= 0) {
                cdLabel.textContent = '0.00 s';
                clearInterval(countdownTimer);
                countdownTimer = null;
                return;
            }
            var s = (diff/1000).toFixed(2);
            cdLabel.textContent = s + ' s';
        }, 100);
    }

    // --- Retry 發射 + latency log ---
    function fireWithRetry(url, config, maxRetries, attempt) {
        attempt = attempt || 1;

        log('INFO', '發送購買請求... (Attempt ' + attempt + '/' + maxRetries + ')');

        var sendTime = Date.now() + serverOffset;

        return fetch(url, config).then(function(r){
            var receiveTime = Date.now() + serverOffset;
            var latency = receiveTime - sendTime;

            var fireDate = new Date(sendTime);
            var fireStr = fireDate.toTimeString().split(' ')[0] + '.' + String(fireDate.getMilliseconds()).padStart(3,'0');
            log('INFO', '實際發射 ServerTime: ' + fireStr + ' (latency: ' + latency + 'ms)');

            if(!r.ok && r.status >= 500 && attempt < maxRetries){
                log('WARNING', '伺服器 5xx ('+r.status+')，準備重試...');
                return new Promise(function(res){
                    setTimeout(res, 300);
                }).then(function(){
                    return fireWithRetry(url, config, maxRetries, attempt+1);
                });
            }

            log(r.ok ? 'SUCCESS' : 'ERROR', '伺服器回應: ' + r.status);
            return r.text();
        });
    }

    // --- Start 按鈕 ---
    btn.onclick = function() {
        var timeStr   = timeInput.value;
        var qty       = parseInt(qtyInput.value)    || 1;
        var offset    = parseInt(offsetInput.value) || 0;
        var fetchCode = fetchInput.value;

        if (!pid)       { log('ERROR', '無法啟動: 缺少商品 ID'); return; }
        if (!fetchCode) { log('ERROR', '無法啟動: 請貼上 Fetch 代碼'); return; }

        // 修正好 regex：[\s\S]
        var match = fetchCode.match(/fetch\((["'])(.*?)\1,\s*({[\s\S]*})\)/);
        if (!match) { log('ERROR', 'Fetch 格式錯誤'); return; }

        var url = match[2];
        var configStr = match[3];
        var config;
        try { config = new Function('return ' + configStr)(); }
        catch(e) { log('ERROR', 'Fetch Config 解析失敗'); return; }

        config.body = JSON.stringify([{ areaItemNo: pid, qty: qty }]);
        config.credentials = 'include';

        var now = new Date(Date.now() + serverOffset);
        var target = new Date(now);
        var t = timeStr.split(':');
        target.setHours(t[0], t[1], t[2], 0);
        var delay = target.getTime() - now.getTime() + offset;

        lastPlannedFireTime = target.getTime() + offset;

        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.innerText = '⏳ 倒數中...';

        if(delay < 0) {
            log('WARNING', '時間已過，立即發射! (Delay: ' + delay + 'ms)');
            delay = 0;
        } else {
            log('INFO', '將於 ' + (delay/1000).toFixed(3) + ' 秒後發送請求 (Offset: ' + offset + 'ms | ServerOffset: ' + serverOffset + 'ms)');
        }

        startCountdown(lastPlannedFireTime);

        setTimeout(function() {
            fireWithRetry(url, config, 5)
                .then(function(txt){
                    var parsed = null;
                    try { parsed = JSON.parse(txt); } catch(_) {}

                    if(parsed && parsed.totalCartCount){
                        log('SUCCESS', '🎉 加入購物車成功! 總數量: ' + parsed.totalCartCount);
                    } else if(parsed && parsed.additional && parsed.additional.productOutOfStock){
                        log('WARNING', '商品已售罄 (productOutOfStock=true)');
                    } else if(txt){
                        log('WARNING', '回應異常: ' + txt.slice(0, 120));
                    } else {
                        log('WARNING', '回應為空');
                    }

                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.innerText = '🚀 Start';
                })
                .catch(function(e){
                    log('ERROR', '最終失敗: ' + e);
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.innerText = '🚀 Start';
                });
        }, delay);
    };
})();
