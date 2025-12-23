(function(){
    if(document.getElementById('pbs-main-panel')) return;

    var serverOffset = 0;
    var lastPlannedFireTime = null;
    var countdownTimer = null;
    var suspendedRetryEnabled = true; // UI toggle 用

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
            <span>P-Bandai Sniper V7.3.1</span>\
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
        <div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;font-size:11px;color:#ccc;">\
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">\
                <input id="pbs-sus-toggle" type="checkbox" checked style="margin:0;">\
                <span>Suspended Retry</span>\
            </label>\
        </div>\
        <div style="margin-bottom:10px">\
            <label style="display:block;color:#ccc;font-size:11px">📋 Paste Fetch</label>\
            <textarea id="pbs-fetch" rows="3" style="width:100%;padding:5px;background:#333;color:#aaa;border:1px solid #555;border-radius:4px;font-size:11px;resize:vertical;box-sizing:border-box;" placeholder="fetch(...)"></textarea>\
        </div>\
        <button id="pbs-btn" style="width:100%;padding:10px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px;text-align:center;">🚀 Start</button>\
        <div id="pbs-status" style="margin-top:5px;text-align:center;color:#aaa;font-size:11px">Ready. <span style="color:#00bfff">🛡️Guardian ON</span></div>\
        <div style="margin-top:3px;text-align:right;font-size:10px;color:#666;">v7.3.1 · by Industrial Revolution &amp; Doro Army</div>\
    ';
    document.body.appendChild(panel);

    var timeInput   = document.getElementById('pbs-time');
    var qtyInput    = document.getElementById('pbs-qty');
    var offsetInput = document.getElementById('pbs-offset');
    var fetchInput  = document.getElementById('pbs-fetch');
    var btn         = document.getElementById('pbs-btn');
    var status      = document.getElementById('pbs-status');
    var cdLabel     = document.getElementById('pbs-countdown');
    var susToggle   = document.getElementById('pbs-sus-toggle');

    if (susToggle) {
        susToggle.onchange = function () {
            suspendedRetryEnabled = !!susToggle.checked;
            log('INFO', 'Suspended Retry 已' + (suspendedRetryEnabled ? '啟用' : '關閉'));
        };
    }

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
