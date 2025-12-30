// ==============================================================================
// PB-Sniper V7.3.4 (Cart Status Display)
// Date: 2025-12-30
// Authors: Industrial Revolution + Doro Army
// Logic: Import Fetch -> Override Qty -> Fire -> Analyze Cart Response
// ==============================================================================

(function() {
    'use strict';

    // 0. Cleanup
    const oldUI = document.getElementById('pb-sniper-panel');
    if (oldUI) oldUI.remove();
    console.clear();

    // ==========================================
    // 1. Core State
    // ==========================================
    function getPageItemID() {
        try {
            const input = document.querySelector('input[name="areaItemNo"]');
            if (input && input.value) return input.value;
            const match = location.href.match(/item\/(A\d+)/);
            return match ? match[1] : ""; 
        } catch (e) { return ""; }
    }

    const currentItemID = getPageItemID();

    window.PB_V7 = {
        config: {
            headers: null,
            baseBody: null,
            url: "https://p-bandai.com/api/cart/addToCart",
            isReady: false
        },
        settings: {
            targetId: currentItemID,
            qty: 1,
            startTime: null
        },
        state: {
            status: 'IDLE',
            loopId: null,
            timerId: null,
            count: 0
        }
    };

    // ==========================================
    // 2. Parser
    // ==========================================
    function parseImportedCode(codeStr) {
        try {
            const headersMatch = codeStr.match(/"headers"\s*:\s*({[\s\S]*?})\s*,/);
            if (!headersMatch) throw new Error("找不到 'headers'，請確保 Copy 完整代碼");
            
            const headersObj = JSON.parse(headersMatch[1]);
            let bodyObj = [{ "areaItemNo": "", "qty": 1 }];
            const bodyMatch = codeStr.match(/"body"\s*:\s*(['"`])([\s\S]*?)\1/);
            
            if (bodyMatch) {
                try {
                    let rawBody = bodyMatch[2].replace(/\\"/g, '"');
                    if (rawBody.trim().startsWith('[')) bodyObj = JSON.parse(rawBody);
                } catch(e) {}
            }

            window.PB_V7.config.headers = headersObj;
            window.PB_V7.config.baseBody = JSON.stringify(bodyObj);
            window.PB_V7.config.isReady = true;

            updateStatus("✅ Config Loaded", "#00ff00");
            logMsg("Fetch Code 導入成功! Ready.");
            document.getElementById('pb-import-modal').style.display = 'none';

        } catch (err) {
            alert("解析失敗: " + err.message);
        }
    }

    // ==========================================
    // 3. Shooter (With Cart Analysis)
    // ==========================================
    function checkTimer() {
        if (window.PB_V7.state.status !== 'ARMED') return;
        const now = new Date();
        const diff = window.PB_V7.settings.startTime - now;

        if (diff <= 0) {
            startFiring();
        } else {
            const sec = (diff / 1000).toFixed(1);
            updateMainStatus(`⏳ 倒數: ${sec}s`, "#f1c40f");
            window.PB_V7.state.timerId = requestAnimationFrame(checkTimer);
        }
    }

    function startFiring() {
        cancelAnimationFrame(window.PB_V7.state.timerId);
        window.PB_V7.state.status = 'FIRING';
        updateMainStatus("🔥 FIRE! 搶購中...", "#e74c3c");
        
        const btn = document.getElementById('pb-btn-action');
        btn.innerText = "🛑 停止 (STOP)";
        btn.style.background = "#c0392b";
        btn.onclick = stopSniper;

        fireLoop();
    }

    async function fireLoop() {
        if (window.PB_V7.state.status !== 'FIRING') return;

        window.PB_V7.state.count++;
        updateCount(window.PB_V7.state.count);

        const { targetId, qty } = window.PB_V7.settings;
        const { headers, baseBody, url } = window.PB_V7.config;

        try {
            // [Fix: Qty Override]
            let payloadArr = JSON.parse(baseBody);
            if (!Array.isArray(payloadArr)) payloadArr = [payloadArr];
            payloadArr[0].areaItemNo = targetId;
            payloadArr[0].qty = parseInt(qty, 10);

            logMsg(`發射 -> ID:${targetId} | Qty:${payloadArr[0].qty}`);

            const res = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payloadArr),
                mode: 'cors',
                credentials: 'include'
            });

            const json = await res.json().catch(()=>({}));

            if (res.ok) {
                stopSniper();
                playSound();
                
                // [Fix: Cart Status Analysis]
                // 通常 Response JSON 會有 cart items list
                let cartInfo = "入車成功!";
                let totalItems = 0;
                let targetQtyInCart = 0;

                // 嘗試分析回傳的 JSON (不同地區 PB 結構可能略有不同，這裡做通用處理)
                if (Array.isArray(json)) {
                    // 如果直接回傳 cart array
                    totalItems = json.length;
                    const item = json.find(i => i.areaItemNo === targetId);
                    if (item) targetQtyInCart = item.qty;
                } else if (json.cartItems && Array.isArray(json.cartItems)) {
                     // 如果是 object wrapper
                    totalItems = json.cartItems.length;
                    const item = json.cartItems.find(i => i.areaItemNo === targetId);
                    if (item) targetQtyInCart = item.qty;
                }

                if (totalItems > 0) {
                    cartInfo = `成功! 車內總數: ${totalItems} 件 (本品: ${targetQtyInCart} 隻)`;
                }

                updateMainStatus("🎉 " + cartInfo, "#ffff00");
                logMsg("SUCCESS: " + cartInfo);
                alert("🎉 恭喜! " + cartInfo + "\n請立即結帳!");

            } else {
                // Fail
                const errMsg = json.message || res.statusText;
                logMsg(`Fail: ${res.status} ${errMsg}`);
            }

        } catch (err) {
            logMsg(`Error: ${err.message}`);
        }

        if (window.PB_V7.state.status === 'FIRING') {
            const delay = 1000 + Math.random() * 500;
            window.PB_V7.state.loopId = setTimeout(fireLoop, delay);
        }
    }

    function armSniper() {
        const idVal = document.getElementById('pb-id').value.trim();
        const timeVal = document.getElementById('pb-time').value;
        const qtyVal = document.getElementById('pb-qty').value;

        if (!window.PB_V7.config.isReady) { alert("⚠️ 請先 Import Fetch Code!"); return; }
        if (!idVal) { alert("無 Target ID!"); return; }

        window.PB_V7.settings.targetId = idVal;
        window.PB_V7.settings.qty = parseInt(qtyVal, 10);

        if (timeVal) {
            const now = new Date();
            const [h, m, s] = timeVal.split(':');
            const targetTime = new Date();
            targetTime.setHours(h, m, s || 0, 0);

            if (targetTime < now) {
                if(!confirm("時間已過，立即發射?")) return;
                startFiring();
            } else {
                window.PB_V7.settings.startTime = targetTime;
                window.PB_V7.state.status = 'ARMED';
                updateMainStatus("⏳ 等待時間...", "#f1c40f");
                
                const btn = document.getElementById('pb-btn-action');
                btn.innerText = "🚫 取消 (CANCEL)";
                btn.style.background = "#d35400";
                btn.onclick = stopSniper;
                
                checkTimer();
            }
        } else {
            startFiring();
        }
    }

    function stopSniper() {
        window.PB_V7.state.status = 'IDLE';
        clearTimeout(window.PB_V7.state.loopId);
        cancelAnimationFrame(window.PB_V7.state.timerId);
        updateMainStatus("⏸️ 閒置 (IDLE)", "#aaa");
        
        const btn = document.getElementById('pb-btn-action');
        btn.innerText = "🚀 啟動 / 定時 (START)";
        btn.style.background = "#006600";
        btn.onclick = armSniper;
    }

    // ==========================================
    // 4. UI Construction
    // ==========================================
    const panel = document.createElement('div');
    panel.id = 'pb-sniper-panel';
    panel.style.cssText = `
        position: fixed; top: 20px; left: 20px; z-index: 99999;
        background: rgba(10, 15, 20, 0.95); color: #00ff00;
        width: 340px; padding: 15px; border-radius: 8px;
        border: 2px solid #00ff00; font-family: 'Consolas', monospace; font-size: 12px;
        box-shadow: 0 0 20px rgba(0,255,0,0.2);
    `;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
            <strong style="font-size:14px;">🔫 PB-Sniper V7.3.4</strong>
            <span id="pb-config-status" style="color:#e74c3c;">❌ No Config</span>
        </div>

        <button id="pb-btn-import" style="width:100%; padding:8px; margin-bottom:15px; background:#222; color:#fff; border:1px dashed #555; border-radius:4px; cursor:pointer;">
            📥 Import Fetch Code
        </button>

        <div id="pb-main-status" style="text-align:center; font-size:14px; font-weight:bold; color:#aaa; margin-bottom:15px; background:#111; padding:10px; border-radius:4px;">
            ⏸️ 系統閒置
        </div>

        <div style="background:#222; padding:10px; border-radius:4px; margin-bottom:10px;">
            <div style="margin-bottom:8px;">
                <label style="color:#aaa;">Target Item ID</label>
                <input id="pb-id" type="text" value="${currentItemID}" style="width:100%; background:#111; border:1px solid #444; color:#fff; padding:4px; margin-top:2px;">
            </div>
            <div style="display:flex; gap:10px;">
                <div style="flex:1;">
                    <label style="color:#aaa;">Time (HH:MM:SS)</label>
                    <input id="pb-time" type="time" step="1" style="width:100%; background:#111; border:1px solid #444; color:#fc0; padding:4px; margin-top:2px;">
                </div>
                <div style="width:60px;">
                    <label style="color:#aaa;">Qty</label>
                    <input id="pb-qty" type="number" value="1" min="1" max="24" style="width:100%; background:#111; border:1px solid #444; color:#fff; padding:4px; margin-top:2px;">
                </div>
            </div>
        </div>

        <button id="pb-btn-action" style="width:100%; padding:10px; background:#006600; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:13px;">
            🚀 啟動 / 定時 (START)
        </button>

        <div id="pb-log" style="height:100px; overflow-y:auto; margin-top:10px; background:#000; padding:5px; border:1px solid #333; color:#aaa; font-size:11px;">
            <div>[System] V7.3.4 Loaded.</div>
        </div>
        
        <div style="margin-top:8px; border-top:1px solid #333; padding-top:5px; display:flex; justify-content:space-between; font-size:10px; color:#555;">
            <span style="font-style:italic;">By: Industrial Revolution + Doro Army</span>
            <span>Attempts: <span id="pb-count" style="color:#fff;">0</span></span>
        </div>
    `;
    document.body.appendChild(panel);

    // Modal
    const modal = document.createElement('div');
    modal.id = 'pb-import-modal';
    modal.style.cssText = `display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100000; align-items:center; justify-content:center;`;
    modal.innerHTML = `
        <div style="background:#1a1a1a; padding:20px; width:450px; border-radius:8px; border:2px solid #00ff00; box-shadow:0 0 30px rgba(0,255,0,0.2);">
            <h3 style="margin-top:0; color:#00ff00;">Paste Fetch Code</h3>
            <textarea id="pb-paste-area" style="width:100%; height:200px; background:#000; color:#0f0; border:1px solid #333; font-size:11px; padding:10px; font-family:monospace;"></textarea>
            <div style="margin-top:15px; text-align:right;">
                <button id="pb-btn-cancel" style="padding:8px 15px; background:#444; color:#fff; border:none; cursor:pointer; margin-right:10px;">Cancel</button>
                <button id="pb-btn-confirm" style="padding:8px 15px; background:#006600; color:#fff; border:none; cursor:pointer; font-weight:bold;">Confirm Import</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('pb-btn-import').onclick = () => { document.getElementById('pb-import-modal').style.display = 'flex'; document.getElementById('pb-paste-area').focus(); };
    document.getElementById('pb-btn-cancel').onclick = () => { document.getElementById('pb-import-modal').style.display = 'none'; };
    document.getElementById('pb-btn-confirm').onclick = () => { const code = document.getElementById('pb-paste-area').value; if(code.trim()) parseImportedCode(code); };
    document.getElementById('pb-btn-action').onclick = armSniper;

    function updateStatus(t, c) { document.getElementById('pb-config-status').innerText = t; document.getElementById('pb-config-status').style.color = c; }
    function updateMainStatus(t, c) { document.getElementById('pb-main-status').innerText = t; document.getElementById('pb-main-status').style.color = c; }
    function updateCount(n) { document.getElementById('pb-count').innerText = n; }
    function logMsg(m) { const b = document.getElementById('pb-log'); const t = new Date().toLocaleTimeString().split(' ')[0]; b.innerHTML = `<div><span style="color:#555;">[${t}]</span> ${m}</div>` + b.innerHTML; }
    function playSound() { new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(()=>{}); }

    console.log('%c 🔫 PB-Sniper V7.3.4 Ready', 'color: #0f0; font-size: 14px');

})();

