const K2K_ENCODER = {
    bufToBase64(buffer) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },

    base64ToBuf(base64) {
        const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    },

    encode: (dataObj, domain) => {
        try {
            const jsonStr = JSON.stringify(dataObj);
            const encoder = new TextEncoder();
            let data = encoder.encode(jsonStr);
            data = pako.deflate(data);
            const key = 170; 
            const encrypted = data.map(byte => byte ^ key);
            const encodedData = K2K_ENCODER.bufToBase64(encrypted);
            
            const cleanDomain = (domain || 'anon').replace(/[^a-zA-Z0-9\.\-_]/g, '');
            const safeDomain = cleanDomain || 'anon';

            return `kotndeks://${safeDomain}/${encodedData}`;
        } catch (e) {
            return null;
        }
    },

    decode: (link) => {
        try {
            const raw = link.replace('kotndeks://', '');
            const parts = raw.split('/');
            const encodedData = parts[parts.length - 1];

            let bytes = K2K_ENCODER.base64ToBuf(encodedData);
            const key = 170;
            const decrypted = bytes.map(byte => byte ^ key);
            const decompressed = pako.inflate(decrypted);
            const jsonStr = new TextDecoder().decode(decompressed);
            return JSON.parse(jsonStr);
        } catch (e) {
            return { title: "Ошибка", blocks: [{ h2: "Ошибка 404", text: "Ссылка повреждена или нечитаема.", bg: "#f0f0f0", textCol: "#333" }] };
        }
    }
};

let tabs = [{ id: 1, title: 'Новая вкладка', url: 'home' }];
let activeTabId = 1;
let siteData = { domain: '', title: '', blocks: [{ id: 0, h2: 'Заголовок секции', text: 'Краткое описание секции.', bg: '#ffffff', textCol: '#333333' }] };

const els = {
    tabBar: document.getElementById('tab-bar'),
    content: document.getElementById('content-area'),
    input: document.getElementById('address-input'),
    form: document.getElementById('address-form'),
    icon: document.getElementById('url-icon')
};

function renderTabs() {
    els.tabBar.innerHTML = '';
    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        el.innerHTML = `
            <span>${tab.title}</span>
            <span class="tab-close" onclick="closeTab(event, ${tab.id})">×</span>
        `;
        el.onclick = () => switchTab(tab.id);
        els.tabBar.appendChild(el);
    });
    const addBtn = document.createElement('div');
    addBtn.className = 'new-tab-btn';
    addBtn.innerHTML = '+';
    addBtn.onclick = addTab;
    els.tabBar.appendChild(addBtn);
}

function renderContent() {
    const tab = tabs.find(t => t.id === activeTabId);
    els.input.value = (tab.url === 'home' || tab.url === 'creator') ? '' : tab.url;
    
    const isK2K = tab.url.startsWith('kotndeks://');
    const iconColor = isK2K ? '#ff3b30' : '#9ca1b5';
    const iconPath = isK2K 
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
    
    els.icon.innerHTML = `<span style="color:${iconColor}">${iconPath}</span>`;
    
    els.content.innerHTML = '';

    if (tab.url === 'home') {
        els.content.innerHTML = `
            <div class="home-page">
                <div class="center-content">
                    <div class="logo-k">K</div>
                    <div class="home-input-wrapper">
                        <input type="text" class="home-input" placeholder="Введите ссылку или запрос" onkeydown="if(event.key==='Enter') navigate(this.value)">
                    </div>
                </div>
                <button class="create-btn-bottom" onclick="openCreator()">Create +</button>
            </div>
        `;
    } else if (tab.url === 'creator') {
        els.content.innerHTML = getCreatorHTML();
        setupCreatorListeners();
    } else if (isK2K) {
        const data = K2K_ENCODER.decode(tab.url);
        
        if(data.title) {
            tab.title = data.title;
            renderTabs();
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'rendered-site';
        
        data.blocks.forEach(block => {
            const blockEl = document.createElement('section');
            blockEl.className = 'site-block';
            blockEl.style.backgroundColor = block.bg;
            blockEl.style.color = block.textCol;
            blockEl.innerHTML = `
                <h2>${block.h2 || ''}</h2>
                <p>${(block.text || '').replace(/\n/g, '<br>')}</p>
            `;
            wrapper.appendChild(blockEl);
        });

        els.content.appendChild(wrapper);
    }
}

function getBlockEditorHTML(block) {
    return `
        <div class="block-editor" data-id="${block.id}">
            <div class="block-controls">
                <button onclick="moveBlockUp(${block.id})">↑</button>
                <button onclick="moveBlockDown(${block.id})">↓</button>
                <button onclick="deleteBlock(${block.id})" style="background: #a04040;">×</button>
            </div>
            <div style="display: flex; gap: 10px;">
                <div class="input-group" style="flex: 1;">
                    <label class="input-label">Заголовок секции (H2)</label>
                    <input type="text" class="creator-input block-h2" value="${block.h2 || ''}" oninput="updateBlock(${block.id}, 'h2', this.value)">
                </div>
                <div class="input-group">
                    <label class="input-label">Цвет фона</label>
                    <input type="color" class="creator-input block-bg" value="${block.bg || '#ffffff'}" oninput="updateBlock(${block.id}, 'bg', this.value)">
                </div>
                <div class="input-group">
                    <label class="input-label">Цвет текста</label>
                    <input type="color" class="creator-input block-textCol" value="${block.textCol || '#333333'}" oninput="updateBlock(${block.id}, 'textCol', this.value)">
                </div>
            </div>
            <div class="input-group">
                <label class="input-label">Текст секции</label>
                <textarea class="creator-input input-body block-text" oninput="updateBlock(${block.id}, 'text', this.value)">${block.text || ''}</textarea>
            </div>
        </div>
    `;
}

function getCreatorHTML() {
    return `
        <div class="site-creator">
            <div class="creator-settings">
                <div class="input-group" style="margin-bottom: 20px;">
                    <label class="input-label">Домен (отображение в ссылке)</label>
                    <input type="text" id="in-domain" class="creator-input" placeholder="например: my.blog" value="${siteData.domain}">
                </div>
                <div class="input-group">
                    <label class="input-label">Название вкладки (Title)</label>
                    <input type="text" id="in-title" class="creator-input input-title" placeholder="Например: Мой лендинг" value="${siteData.title}">
                </div>
            </div>

            <div id="blocks-container">
                ${siteData.blocks.map(getBlockEditorHTML).join('')}
            </div>
            
            <button class="add-block-btn" onclick="addBlock()">+ Добавить секцию</button>
            <button class="publish-btn" onclick="publishSite()">Создать автономный сайт (Ссылка)</button>
        </div>
    `;
}

function setupCreatorListeners() {
    window.updateBlock = (id, key, value) => {
        const block = siteData.blocks.find(b => b.id === id);
        if (block) block[key] = value;
    };

    window.addBlock = () => {
        const newId = Date.now();
        siteData.blocks.push({ id: newId, h2: 'Новая секция', text: 'Содержание новой секции.', bg: '#f0f0f0', textCol: '#333333' });
        renderBlocks();
    };

    window.deleteBlock = (id) => {
        if (siteData.blocks.length > 1) {
            siteData.blocks = siteData.blocks.filter(b => b.id !== id);
            renderBlocks();
        } else {
            alert("Нельзя удалить последнюю секцию.");
        }
    };

    window.moveBlock = (id, direction) => {
        const index = siteData.blocks.findIndex(b => b.id === id);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < siteData.blocks.length) {
            [siteData.blocks[index], siteData.blocks[newIndex]] = [siteData.blocks[newIndex], siteData.blocks[index]];
            renderBlocks();
        }
    };

    window.moveBlockUp = (id) => moveBlock(id, -1);
    window.moveBlockDown = (id) => moveBlock(id, 1);
}

function renderBlocks() {
    const container = document.getElementById('blocks-container');
    if (container) {
        container.innerHTML = siteData.blocks.map(getBlockEditorHTML).join('');
    }
}

function addTab() {
    const newId = Date.now();
    tabs.push({ id: newId, title: 'Новая вкладка', url: 'home' });
    activeTabId = newId;
    renderTabs();
    renderContent();
}

function closeTab(e, id) {
    e.stopPropagation();
    if (tabs.length === 1) return;
    tabs = tabs.filter(t => t.id !== id);
    if (id === activeTabId) activeTabId = tabs[tabs.length - 1].id;
    renderTabs();
    renderContent();
}

function switchTab(id) {
    activeTabId = id;
    renderTabs();
    renderContent();
}

function openCreator() {
    const tab = tabs.find(t => t.id === activeTabId);
    tab.url = 'creator';
    tab.title = 'Создание сайта';
    renderTabs();
    renderContent();
}

window.navigate = (val) => {
    if (!val) return;
    const tab = tabs.find(t => t.id === activeTabId);
    tab.url = val.startsWith('kotndeks://') ? val : 'kotndeks://' + val; 
    tab.title = 'Kotndeks-сайт';
    renderTabs();
    renderContent();
}

window.publishSite = () => {
    const domain = document.getElementById('in-domain').value;
    const title = document.getElementById('in-title').value;
    
    if (siteData.blocks.length === 0) return alert("Необходимо добавить хотя бы одну секцию!");

    siteData.domain = domain;
    siteData.title = title;
    
    const link = K2K_ENCODER.encode(siteData, domain);
    
    const tab = tabs.find(t => t.id === activeTabId);
    tab.url = link;
    tab.title = title || 'Kotndeks-сайт';
    renderTabs();
    renderContent();
};

els.form.onsubmit = (e) => {
    e.preventDefault();
    navigate(els.input.value.trim());
};

document.addEventListener('DOMContentLoaded', () => {
    addTab(); 
    closeTab({stopPropagation:()=>{}}, 1); 
});