const API = {
  async init() {
    const res = await fetch('/api/init', { method: 'POST' })
    return res.json()
  },
  async load() {
    const res = await fetch('/api/load', { method: 'POST' })
    return res.json()
  },
  async getStructure() {
    const res = await fetch('/api/structure')
    return res.json()
  },
  async addCategory(name) {
    const res = await fetch('/api/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    return res.json()
  },
  async addServer(category, server) {
    const res = await fetch('/api/server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, server })
    })
    return res.json()
  },
  async removeServer(category, server) {
    const res = await fetch(`/api/server/${category}/${server}`, {
      method: 'DELETE'
    })
    return res.json()
  },
  async createGrant(path, level) {
    const res = await fetch('/api/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, level: parseInt(level) })
    })
    return res.json()
  },
  async createDrive() {
    const res = await fetch('/api/drive/create', { method: 'POST' })
    return res.json()
  },
  async audit() {
    const res = await fetch('/api/audit')
    return res.json()
  }
}

const state = {
  structure: {},
  grants: []
}

function showStatus(element, message, type = 'info') {
  element.textContent = message
  element.className = `status ${type}`
}

function renderStructure() {
  const tree = document.getElementById('structure-tree')
  const select = document.getElementById('category-select')

  tree.innerHTML = ''
  select.innerHTML = '<option value="">Select category...</option>'

  for (const category in state.structure) {
    select.innerHTML += `<option value="${category}">${category}</option>`

    const catDiv = document.createElement('div')
    catDiv.className = 'category'

    const catName = document.createElement('div')
    catName.className = 'category-name'
    catName.textContent = `📁 ${category}`
    catDiv.appendChild(catName)

    const serverList = document.createElement('div')
    serverList.className = 'server-list'

    for (const server of state.structure[category]) {
      const serverItem = document.createElement('div')
      serverItem.className = 'server-item'
      serverItem.innerHTML = `
        <span>🖥️ ${server}</span>
        <button data-category="${category}" data-server="${server}" class="remove-server">Remove</button>
      `
      serverList.appendChild(serverItem)
    }

    catDiv.appendChild(serverList)
    tree.appendChild(catDiv)
  }

  document.querySelectorAll('.remove-server').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const category = e.target.dataset.category
      const server = e.target.dataset.server
      const result = await API.removeServer(category, server)
      state.structure = result.structure
      renderStructure()
    })
  })
}

function renderGrants() {
  const list = document.getElementById('grants-list')
  list.innerHTML = ''

  for (const grant of state.grants) {
    const item = document.createElement('div')
    item.className = 'grant-item'

    const levelNames = ['NONE', 'PUBLIC_ONLY', 'CATEGORY_READ', 'CATEGORY_SIGN', 'FULL_CONTROL']

    item.innerHTML = `
      <div class="grant-path">${grant.path || 'master'} - ${levelNames[grant.level]}</div>
      <div class="grant-details">${JSON.stringify(grant.grant, null, 2)}</div>
    `
    list.appendChild(item)
  }
}

document.getElementById('init-btn').addEventListener('click', async () => {
  const status = document.getElementById('master-status')
  const result = await API.init()
  if (result.success) {
    showStatus(status, `✓ Master key created: ${result.publicKey.substring(0, 16)}...`, 'success')
  } else {
    showStatus(status, `✗ Error: ${result.error}`, 'error')
  }
})

document.getElementById('load-btn').addEventListener('click', async () => {
  const status = document.getElementById('master-status')
  const result = await API.load()
  if (result.success) {
    showStatus(status, `✓ Master key loaded: ${result.publicKey.substring(0, 16)}...`, 'success')
  } else {
    showStatus(status, `✗ Error: ${result.error}`, 'error')
  }
})

document.getElementById('add-category-btn').addEventListener('click', async () => {
  const input = document.getElementById('category-input')
  const name = input.value.trim()
  if (!name) return

  const result = await API.addCategory(name)
  state.structure = result.structure
  renderStructure()
  input.value = ''
})

document.getElementById('add-server-btn').addEventListener('click', async () => {
  const category = document.getElementById('category-select').value
  const server = document.getElementById('server-input').value.trim()
  if (!category || !server) return

  const result = await API.addServer(category, server)
  state.structure = result.structure
  renderStructure()
  document.getElementById('server-input').value = ''
})

document.getElementById('create-grant-btn').addEventListener('click', async () => {
  const path = document.getElementById('grant-path').value.trim()
  const level = document.getElementById('grant-level').value

  const result = await API.createGrant(path, level)
  if (result.success) {
    state.grants.push({ path, level: parseInt(level), grant: result.grant })
    renderGrants()
    document.getElementById('grant-path').value = ''
  }
})

document.getElementById('create-drive-btn').addEventListener('click', async () => {
  const status = document.getElementById('drive-status')
  const keyDiv = document.getElementById('drive-key')

  showStatus(status, 'Creating Hyperdrive...', 'info')

  const result = await API.createDrive()
  if (result.success) {
    showStatus(status, '✓ Drive created and tree exported', 'success')
    keyDiv.textContent = `Drive Key: ${result.driveKey}`
  } else {
    showStatus(status, `✗ Error: ${result.error}`, 'error')
  }
})

document.getElementById('audit-btn').addEventListener('click', async () => {
  const output = document.getElementById('audit-output')
  const result = await API.audit()
  if (result.report) {
    output.textContent = result.report
  } else {
    output.textContent = `Error: ${result.error}`
  }
})

async function init() {
  const result = await API.getStructure()
  state.structure = result.structure
  renderStructure()
}

init()
