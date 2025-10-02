const { exportTree, deriveKey, from } = require('@keyringer/core')

const buildTree = (master, structure) => {
  const paths = []
  for (const category in structure) {
    for (const server of structure[category]) {
      paths.push(`${category}/${server}`)
    }
  }
  return exportTree(from(master), paths)
}

const listKeys = (master, structure) => {
  const keys = {}
  const base = from(master)
  for (const category in structure) {
    keys[category] = {}
    const catKey = base.get(category)
    keys[category]._pub = catKey.publicKey.toString('hex')
    for (const server of structure[category]) {
      const serverKey = base.sub(category).get(server)
      keys[category][server] = {
        public: serverKey.publicKey.toString('hex'),
        private: serverKey.scalar?.toString('hex'),
        path: `${category}/${server}`
      }
    }
  }
  return keys
}

const rotateCategory = (master, oldCat, newCat, structure) => {
  const newStructure = { ...structure }
  if (structure[oldCat]) {
    newStructure[newCat] = structure[oldCat]
    delete newStructure[oldCat]
  }
  return buildTree(master, newStructure)
}

const addServer = (master, category, server, structure) => {
  const newStructure = { ...structure }
  if (!newStructure[category]) newStructure[category] = []
  if (!newStructure[category].includes(server)) {
    newStructure[category].push(server)
  }
  return buildTree(master, newStructure)
}

const removeServer = (master, category, server, structure) => {
  const newStructure = { ...structure }
  if (newStructure[category]) {
    newStructure[category] = newStructure[category].filter(s => s !== server)
    if (!newStructure[category].length) delete newStructure[category]
  }
  return buildTree(master, newStructure)
}

module.exports = {
  buildTree,
  listKeys,
  rotateCategory,
  addServer,
  removeServer
}
