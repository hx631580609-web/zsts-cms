// 通用JSON编辑器 - 渲染任意JSON结构到表单
// 支持：字符串、数字、布尔、对象、数组、双语对象({"zh":"","en":""})

const API_BASE = '/api';

// 检测是否为双语对象 {zh: "", en: ""}
function isBilingual(obj) {
  return obj && typeof obj === 'object' && 'zh' in obj && 'en' in obj;
}

// 渲染JSON编辑器UI
function renderJsonEditor(containerId, data, path = '', onchange = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(renderValue(data, path, onchange));
}

// 渲染单个值
function renderValue(value, path, onchange) {
  if (value === null || value === undefined) {
    return createElement('span', { className: 'text-gray-400' }, 'null');
  }

  if (Array.isArray(value)) {
    return renderArray(value, path, onchange);
  }

  if (typeof value === 'object') {
    // 检查是否为双语对象
    if (isBilingual(value)) {
      return renderBilingual(value, path, onchange);
    }
    return renderObject(value, path, onchange);
  }

  if (typeof value === 'string') {
    // 长文本用textarea
    if (value.length > 80) {
      return renderTextarea(value, path, onchange);
    }
    return renderInput(value, path, onchange);
  }

  if (typeof value === 'number') {
    return renderNumber(value, path, onchange);
  }

  if (typeof value === 'boolean') {
    return renderBoolean(value, path, onchange);
  }

  return createElement('span', {}, String(value));
}

// 创建DOM元素
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') el.className = val;
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
    else el.setAttribute(key, val);
  }
  if (typeof children === 'string') el.textContent = children;
  else if (Array.isArray(children)) children.forEach(c => {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  });
  return el;
}

// 渲染输入框
function renderInput(value, path, onchange) {
  const input = createElement('input', {
    type: 'text',
    value: value,
    className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zsts-green focus:border-transparent text-sm',
    oninput: (e) => onchange && onchange(path, e.target.value)
  });
  return input;
}

// 渲染数字输入
function renderNumber(value, path, onchange) {
  const input = createElement('input', {
    type: 'number',
    value: value,
    className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zsts-green focus:border-transparent text-sm',
    oninput: (e) => onchange && onchange(path, parseFloat(e.target.value))
  });
  return input;
}

// 渲染多行文本
function renderTextarea(value, path, onchange) {
  const ta = createElement('textarea', {
    value: value,
    rows: 3,
    className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zsts-green focus:border-transparent text-sm',
    oninput: (e) => onchange && onchange(path, e.target.value)
  });
  return ta;
}

// 渲染布尔值
function renderBoolean(value, path, onchange) {
  const select = createElement('select', {
    className: 'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zsts-green focus:border-transparent text-sm',
    onchange: (e) => onchange && onchange(path, e.target.value === 'true')
  });
  select.appendChild(createElement('option', { value: 'true', selected: value === true }, '是'));
  select.appendChild(createElement('option', { value: 'false', selected: value === false }, '否'));
  return select;
}

// 渲染双语对象
function renderBilingual(value, path, onchange) {
  const wrapper = createElement('div', { className: 'grid grid-cols-2 gap-3' });
  
  const zhGroup = createElement('div', {});
  zhGroup.appendChild(createElement('label', { className: 'block text-xs text-gray-500 mb-1' }, '中文'));
  zhGroup.appendChild(renderInput(value.zh, `${path}.zh`, (p, v) => onchange && onchange(p, v)));
  
  const enGroup = createElement('div', {});
  enGroup.appendChild(createElement('label', { className: 'block text-xs text-gray-500 mb-1' }, 'English'));
  enGroup.appendChild(renderInput(value.en, `${path}.en`, (p, v) => onchange && onchange(p, v)));
  
  wrapper.appendChild(zhGroup);
  wrapper.appendChild(enGroup);
  return wrapper;
}

// 渲染对象
function renderObject(obj, path, onchange) {
  const wrapper = createElement('div', { className: 'space-y-4' });
  
  for (const [key, val] of Object.entries(obj)) {
    const item = createElement('div', { className: 'border-b border-gray-100 pb-4' });
    
    const label = createElement('label', {
      className: 'block text-sm font-semibold text-gray-700 mb-2'
    }, key);
    item.appendChild(label);
    
    const editor = renderValue(val, `${path}.${key}`, onchange);
    if (editor) item.appendChild(editor);
    
    wrapper.appendChild(item);
  }
  
  return wrapper;
}

// 渲染数组
function renderArray(arr, path, onchange) {
  const wrapper = createElement('div', { className: 'space-y-3' });
  
  arr.forEach((item, index) => {
    const itemWrapper = createElement('div', {
      className: 'flex items-start space-x-3 p-3 bg-gray-50 rounded-lg'
    });
    
    const indexBadge = createElement('span', {
      className: 'inline-flex items-center justify-center w-6 h-6 bg-zsts-green text-white text-xs rounded-full flex-shrink-0 mt-1'
    }, String(index + 1));
    
    const editor = renderValue(item, `${path}[${index}]`, onchange);
    if (editor) {
      editor.className = (editor.className || '') + ' flex-1';
      itemWrapper.appendChild(indexBadge);
      itemWrapper.appendChild(editor);
    }
    
    // 删除按钮
    const delBtn = createElement('button', {
      className: 'text-red-500 hover:text-red-700 mt-1',
      onclick: () => {
        arr.splice(index, 1);
        onchange && onchange(path, arr);
        // 重新渲染
        const parent = wrapper.parentNode;
        if (parent) {
          parent.innerHTML = '';
          parent.appendChild(renderArray(arr, path, onchange));
        }
      }
    }, '✕');
    itemWrapper.appendChild(delBtn);
    
    wrapper.appendChild(itemWrapper);
  });
  
  // 添加按钮
  const addBtn = createElement('button', {
    className: 'w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-zsts-green hover:text-zsts-green transition-colors',
    onclick: () => {
      arr.push(getDefaultValueForArray(arr));
      onchange && onchange(path, arr);
      const parent = wrapper.parentNode;
      if (parent) {
        parent.innerHTML = '';
        parent.appendChild(renderArray(arr, path, onchange));
      }
    }
  }, '+ 添加项目');
  wrapper.appendChild(addBtn);
  
  return wrapper;
}

// 获取数组项的默认值
function getDefaultValueForArray(arr) {
  if (arr.length === 0) return {};
  const first = arr[0];
  if (typeof first === 'object' && !Array.isArray(first)) {
    // 返回空对象，结构同第一项
    const template = {};
    for (const key of Object.keys(first)) {
      template[key] = typeof first[key] === 'object' ? getDefaultValueForArray([]) : '';
    }
    return template;
  }
  return '';
}

// 根据path设置值
function setValueByPath(obj, path, value) {
  const keys = path.split(/[\.\[\]]+/).filter(Boolean);
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = isNaN(keys[i]) ? keys[i] : parseInt(keys[i]);
    if (!(key in current)) {
      current[key] = isNaN(keys[i + 1]) ? {} : [];
    }
    current = current[key];
  }
  const lastKey = keys[keys.length - 1];
  current[isNaN(lastKey) ? lastKey : parseInt(lastKey)] = value;
}

// 根据path获取值
function getValueByPath(obj, path) {
  const keys = path.split(/[\.\[\]]+/).filter(Boolean);
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[isNaN(key) ? key : parseInt(key)];
  }
  return current;
}

// 导出
window.JsonEditor = {
  render: renderJsonEditor,
  setValueByPath,
  getValueByPath,
  isBilingual
};
