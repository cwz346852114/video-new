<template>
  <view class="app-shell" @dragover.prevent @drop.prevent="handleDrop">
    <view class="main-panel">
      <view class="content-grid">
        <view class="player-card">
          <view v-if="!currentMedia" class="empty-state">
            <text class="empty-icon">▶</text>
            <text class="empty-title">给「{{ currentGroup.name }}」添加文件</text>
            <text class="empty-text">添加或拖入文件后，只会进入当前分组，并按该分组列表播放。</text>
          </view>

          <view v-else class="player-wrap">
            <view class="player-top-overlay">
              <!-- <text class="player-badge">{{ currentGroup.name }}</text> -->
              <!-- <text class="player-title">{{ formatDisplayName(currentMedia.name) }}</text> -->
            </view>
            <video
              ref="playerRef"
              class="player"
              :src="currentMedia.url"
              controls
              @ended="playNext"
              @error="handleError"
              @play="handlePlay"
              @pause="handlePause"
              @timeupdate="rememberProgress"
              @loadedmetadata="syncPlaybackRate"
            ></video>
            <button class="center-play-button" :class="{ playing: isPlaying }" @click.stop="togglePlay">
              {{ isPlaying ? '⏸' : '▶' }}
            </button>
            <view v-if="currentMedia.kind === 'audio'" class="audio-overlay">
              <text class="audio-icon">♪</text>
            </view>
            <view class="player-bottom-fade"></view>
            <view class="control-bar">
              <button class="control-button ghost tooltip-button" data-tip="后退 10 秒" @click="seekBy(-10)">↶</button>
              <button class="control-button tooltip-button" data-tip="上一个" @click="playPrevious">⏮</button>
              <button class="control-button play-control tooltip-button" :data-tip="isPlaying ? '暂停' : '播放'" @click="togglePlay">{{ isPlaying ? '⏸' : '▶' }}</button>
              <button class="control-button tooltip-button" data-tip="下一个" @click="playNext">⏭</button>
              <button class="control-button ghost tooltip-button" data-tip="快进 10 秒" @click="seekBy(10)">↷</button>
              <button class="control-button ghost tooltip-button" data-tip="降低音量" @click="changeVolume(-0.1)">🔉</button>
              <button class="control-button ghost tooltip-button" data-tip="提高音量" @click="changeVolume(0.1)">🔊</button>
              <button class="control-button ghost tooltip-button" :data-tip="`播放模式：${playModeLabel}`" @click="togglePlayMode">{{ playModeIcon }}</button>
              <button class="control-button ghost tooltip-button" data-tip="全屏" @click="toggleFullscreen">⛶</button>
              <view class="speed-box">
                <text class="speed-label">倍速</text>
                <picker :value="speedIndex" :range="speedOptions" @change="changeSpeed">
                  <view class="speed-picker">{{ playbackRate }}x</view>
                </picker>
              </view>
              <view class="speed-box volume-box">
                <text class="speed-label">音量</text>
                <text class="speed-picker">{{ volumePercent }}%</text>
              </view>
            </view>
          </view>
        </view>

        <view class="right-panel">
          <view class="library-section">
            <view class="panel-header">
              <view>
                <text class="playlist-title">媒体库</text>
                <text class="playlist-tip">{{ activeModuleLabel }} · {{ currentGroups.length }} 个分组 · {{ currentModuleFileCount }} 个文件</text>
              </view>
            </view>

            <view class="library-tabs">
              <button v-for="module in modules" :key="module.key" class="library-tab" :class="{ active: activeModule === module.key }" @click="switchModule(module.key)">
                {{ module.label }}
              </button>
            </view>

            <scroll-view class="library-tree" scroll-y>
              <view class="module-tools">
             
                <button class="icon-action" @click.stop="createGroup(activeModule)">添加分组</button>
              </view>

              <view v-for="group in currentGroups" :key="group.id" class="group-node">
                <view class="group-item" @click="selectGroup(group.id, activeModule)">
            
                  <view class="tree-main" @click.stop="toggleGroup(group.id, activeModule)">
                    <text class="group-name">{{ expandedGroups[group.id] ? '▾' : '▸' }} {{ group.name }}</text>
                    <text class="group-count">{{ group.items.length }} 个文件 </text>
                  </view>
                  <view class="group-actions">
                    <button class="mini-button icon-mini add tooltip-button" data-tip="添加文件" @click.stop="addFiles(group.id, activeModule)">＋</button>
                    <button class="mini-button icon-mini tooltip-button" data-tip="重命名" @click.stop="renameGroup(group.id, activeModule)">✎</button>
                    <button class="mini-button icon-mini danger tooltip-button" data-tip="删除" @click.stop="deleteGroup(group.id, activeModule)">🗑</button>
                  </view>
                </view>

                <view v-if="expandedGroups[group.id]" class="media-children">
                  <view v-if="group.items.length === 0" class="list-empty compact">当前分组还没有文件</view>
                  <view v-for="item in group.items" :key="item.id" class="media-row" :class="{ active: item.id === currentMediaId }" @click="playItem(item.id, group.id, activeModule)">
                    <text class="media-index">{{ getGroupItemIndex(group, item.id) + 1 }}</text>
                    <view class="media-row-main">
                      <text class="media-row-name">{{ formatDisplayName(item.name) }}</text>
                      <!-- <text class="media-row-meta">{{ item.ext.toUpperCase() }} · {{ item.kind === 'audio' ? '音频' : '视频' }}{{ getProgressText(item.id) ? ` · ${getProgressText(item.id)}` : '' }}</text> -->
                    </view>
                    <button class="move-button" @click.stop="moveItemToGroup(item.id, group.id, activeModule)">移动</button>
                    <button class="remove-button" @click.stop="removeItem(item.id, group.id, activeModule)">移除</button>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
const videoExts = ['mp4', 'avi', 'm3u8', 'mov', 'mkv', 'webm']
const speedOptions = ['0.5', '0.75', '1', '1.25', '1.5', '2', '2.5', '3']
const storageKey = 'uni-video-player-state'
const playModes = ['order', 'single', 'random']
const playModeMap = {
  order: '顺序',
  single: '单曲',
  random: '随机',
}
const playModeIconMap = {
  order: '⇄',
  single: '↻',
  random: '🔀',
}

function createDefaultLibrary() {
  return {
    video: [{ id: 'video-default', name: '默认视频分组', items: [] }],
    audio: [{ id: 'audio-default', name: '默认音频分组', items: [] }],
  }
}

function normalizeLibrary(library) {
  const defaults = createDefaultLibrary()
  return ['video', 'audio'].reduce((normalized, moduleKey) => {
    const groups = Array.isArray(library?.[moduleKey]) && library[moduleKey].length ? library[moduleKey] : defaults[moduleKey]
    normalized[moduleKey] = groups.map((group, index) => ({
      id: group.id || `${moduleKey}-${Date.now()}-${index}`,
      name: group.name || (moduleKey === 'video' ? `视频分组${index + 1}` : `音频分组${index + 1}`),
      items: Array.isArray(group.items) ? group.items : [],
    }))
    return normalized
  }, {})
}

export default {
  data() {
    return {
      modules: [
        { key: 'video', label: '视频' },
        { key: 'audio', label: '音频' },
      ],
      library: createDefaultLibrary(),
      activeModule: 'video',
      activeGroupId: 'video-default',
      currentMediaId: '',
      playbackRate: 1,
      speedOptions,
      playMode: 'order',
      volume: 1,
      progressMap: {},
      warning: '',
      isPlaying: false,
      expandedModules: { video: true, audio: true },
      expandedGroups: { 'video-default': true },
    }
  },
  mounted() {
    this.restoreState()
    window.addEventListener('keydown', this.handleShortcut)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleShortcut)
    this.saveState()
  },
  computed: {
    activeModuleLabel() {
      return this.modules.find(module => module.key === this.activeModule)?.label || ''
    },
    currentGroups() {
      return this.library[this.activeModule] || []
    },
    currentGroup() {
      return this.currentGroups.find(group => group.id === this.activeGroupId) || this.currentGroups[0] || { id: '', name: '默认分组', items: [] }
    },
    currentMedia() {
      return this.currentGroup.items.find(item => item.id === this.currentMediaId) || null
    },
    speedIndex() {
      return this.speedOptions.indexOf(String(this.playbackRate))
    },
    playModeLabel() {
      return playModeMap[this.playMode]
    },
    playModeIcon() {
      return playModeIconMap[this.playMode]
    },
    volumePercent() {
      return Math.round(this.volume * 100)
    },
    currentProgressText() {
      return this.getProgressText(this.currentMediaId)
    },
    currentModuleFileCount() {
      return this.currentGroups.reduce((total, group) => total + group.items.length, 0)
    },
    activeQueueText() {
      if (!this.currentGroup.items.length) {
        return '空队列'
      }
      const currentIndex = this.getItemIndex(this.currentMediaId)
      if (currentIndex < 0) {
        return '待选择播放'
      }
      return `第 ${currentIndex + 1} / ${this.currentGroup.items.length} 个`
    },
  },
  watch: {
    currentMediaId() {
      this.saveState()
      this.$nextTick(() => {
        this.syncPlaybackRate()
        this.syncVolume()
        this.restoreProgress()
      })
    },
    activeModule() {
      this.saveState()
    },
    activeGroupId() {
      this.saveState()
    },
    playbackRate() {
      this.saveState()
    },
    playMode() {
      this.saveState()
    },
    volume() {
      this.saveState()
      this.syncVolume()
    },
    library: {
      deep: true,
      handler() {
        this.saveState()
      },
    },
  },
  methods: {
    getModuleGroups(moduleKey) {
      return this.library[moduleKey] || []
    },
    getModuleFileCount(moduleKey) {
      return this.getModuleGroups(moduleKey).reduce((total, group) => total + group.items.length, 0)
    },
    getModuleLabel(moduleKey) {
      return this.modules.find(module => module.key === moduleKey)?.label || ''
    },
    getGroupItemIndex(group, itemId) {
      return group.items.findIndex(item => item.id === itemId)
    },
    formatDisplayName(name, maxLength = 120) {
      if (!name || name.length <= maxLength) {
        return name || ''
      }
      return `${name.slice(0, maxLength)}...`
    },
    toggleModule(moduleKey) {
      this.expandedModules[moduleKey] = !this.expandedModules[moduleKey]
      if (!this.expandedModules[moduleKey]) {
        return
      }
      if (this.activeModule !== moduleKey) {
        this.switchModule(moduleKey)
      }
    },
    toggleGroup(groupId, moduleKey = this.activeModule) {
      this.expandedGroups[groupId] = !this.expandedGroups[groupId]
      if (this.expandedGroups[groupId]) {
        this.selectGroup(groupId, moduleKey)
      }
    },
    switchModule(moduleKey) {
      this.activeModule = moduleKey
      this.expandedModules[moduleKey] = true
      this.activeGroupId = this.library[moduleKey][0].id
      this.expandedGroups[this.activeGroupId] = true
      this.currentMediaId = this.currentGroup.items[0]?.id || ''
      this.warning = ''
    },
    renameGroup(groupId, moduleKey = this.activeModule) {
      const group = this.getModuleGroups(moduleKey).find(item => item.id === groupId)
      if (!group) {
        return
      }
      const groupName = window.prompt('请输入新的分组名称', group.name)?.trim()
      if (groupName) {
        group.name = groupName
      }
    },
    deleteGroup(groupId, moduleKey = this.activeModule) {
      const groups = this.getModuleGroups(moduleKey)
      if (groups.length <= 1) {
        this.warning = '至少需要保留一个分组。'
        return
      }
      const group = groups.find(item => item.id === groupId)
      if (!group || !window.confirm(`确定删除「${group.name}」吗？`)) {
        return
      }
      this.library[moduleKey] = groups.filter(item => item.id !== groupId)
      delete this.expandedGroups[groupId]
      if (this.activeGroupId === groupId || this.activeModule === moduleKey) {
        this.activeModule = moduleKey
        this.activeGroupId = this.library[moduleKey][0].id
        this.expandedGroups[this.activeGroupId] = true
        this.currentMediaId = ''
      }
    },
    selectGroup(groupId, moduleKey = this.activeModule) {
      this.activeModule = moduleKey
      this.expandedModules[moduleKey] = true
      this.expandedGroups[groupId] = true
      this.activeGroupId = groupId
      this.currentMediaId = this.currentGroup.items[0]?.id || ''
      this.warning = ''
    },
    createGroup(moduleKey = this.activeModule) {
      const groups = this.getModuleGroups(moduleKey)
      const defaultName = moduleKey === 'video' ? '视频分组' : '音频分组'
      const groupName = window.prompt('请输入分组名称', `${defaultName}${groups.length + 1}`)
      if (!groupName) {
        return
      }

      const group = {
        id: `${moduleKey}-${Date.now()}`,
        name: groupName.trim(),
        items: [],
      }
      this.library[moduleKey].push(group)
      this.activeModule = moduleKey
      this.activeGroupId = group.id
      this.expandedModules[moduleKey] = true
      this.expandedGroups[group.id] = true
    },
    async addFiles(groupId = this.activeGroupId, moduleKey = this.activeModule) {
      if (window.electronMedia) {
        const files = await window.electronMedia.openFiles()
        this.addMediaFiles(files, groupId, moduleKey)
        return
      }

      this.openBrowserFilePicker(groupId, moduleKey)
    },
    openBrowserFilePicker(groupId = this.activeGroupId, moduleKey = this.activeModule) {
      if (!document?.createElement) {
        this.warning = '当前平台暂不支持直接选择本地文件。'
        return
      }

      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = moduleKey === 'audio' ? 'audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a' : 'video/*,.mp4,.avi,.m3u8,.mov,.mkv,.webm'
      input.style.display = 'none'
      input.addEventListener('change', event => {
        const files = Array.from(event.target.files || []).map(file => this.toBrowserMediaFile(file))
        this.addMediaFiles(files, groupId, moduleKey)
        input.remove()
      })
      document.body.appendChild(input)
      input.click()
    },
    toBrowserMediaFile(file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        url: URL.createObjectURL(file),
        path: file.webkitRelativePath || file.name,
        name: file.name,
        ext,
      }
    },
    handleDrop(event) {
      const droppedFiles = Array.from(event.dataTransfer?.files || [])
      if (window.electronMedia && droppedFiles.every(file => file.path)) {
        this.addMediaFiles(window.electronMedia.toMediaFiles(droppedFiles.map(file => file.path)))
        return
      }

      const files = droppedFiles.map(file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          url: URL.createObjectURL(file),
          path: file.path || file.name,
          name: file.name,
          ext,
        }
      })
      this.addMediaFiles(files)
    },
    addMediaFiles(files, groupId = this.activeGroupId, moduleKey = this.activeModule) {
      if (!files.length) {
        return
      }
      const targetGroup = this.getModuleGroups(moduleKey).find(group => group.id === groupId)
      if (!targetGroup) {
        this.warning = '目标分组不存在，无法添加文件。'
        return
      }

      const normalizedFiles = files.map(file => ({
        ...file,
        kind: audioExts.includes(file.ext) ? 'audio' : 'video',
      }))
      const matchedFiles = normalizedFiles.filter(file => file.kind === moduleKey)
      const skippedCount = normalizedFiles.length - matchedFiles.length

      if (matchedFiles.length) {
        targetGroup.items.push(...matchedFiles)
        this.expandedModules[moduleKey] = true
        this.expandedGroups[groupId] = true
        if (!this.currentMediaId && groupId === this.activeGroupId && moduleKey === this.activeModule) {
          this.currentMediaId = matchedFiles[0].id
        }
      }

      const moduleLabel = this.getModuleLabel(moduleKey)
      this.warning = skippedCount ? `已跳过 ${skippedCount} 个不属于${moduleLabel}模块的文件。` : this.getFormatWarning(matchedFiles[0]?.ext)
    },
    playItem(itemId, groupId = this.activeGroupId, moduleKey = this.activeModule) {
      if (groupId !== this.activeGroupId || moduleKey !== this.activeModule) {
        this.activeModule = moduleKey
        this.activeGroupId = groupId
        this.expandedModules[moduleKey] = true
        this.expandedGroups[groupId] = true
      }
      this.currentMediaId = itemId
      this.warning = this.getFormatWarning(this.currentMedia?.ext)
      this.$nextTick(() => {
        const player = this.getPlayer()
        if (player) {
          player.play()
          this.isPlaying = true
        }
      })
    },
    getItemIndex(itemId) {
      return this.currentGroup.items.findIndex(item => item.id === itemId)
    },
    moveItemToGroup(itemId, groupId = this.activeGroupId, moduleKey = this.activeModule) {
      const groups = this.getModuleGroups(moduleKey)
      const sourceGroup = groups.find(group => group.id === groupId)
      if (!sourceGroup) {
        return
      }
      if (groups.length <= 1) {
        this.warning = '请先新建其它分组，再移动文件。'
        return
      }

      const sourceIndex = sourceGroup.items.findIndex(item => item.id === itemId)
      if (sourceIndex < 0) {
        return
      }

      const options = groups
        .filter(group => group.id !== groupId)
        .map((group, index) => `${index + 1}. ${group.name}`)
        .join('\n')
      const selectedNumber = Number(window.prompt(`移动到哪个分组？\n${options}`))
      const targetGroup = groups.filter(group => group.id !== groupId)[selectedNumber - 1]
      if (!targetGroup) {
        return
      }

      const [item] = sourceGroup.items.splice(sourceIndex, 1)
      targetGroup.items.push(item)
      if (this.currentMediaId === itemId) {
        this.currentMediaId = sourceGroup.items[sourceIndex]?.id || sourceGroup.items[sourceIndex - 1]?.id || ''
      }
      this.expandedGroups[targetGroup.id] = true
      this.warning = `已移动到「${targetGroup.name}」。`
    },
    removeItem(itemId, groupId = this.activeGroupId, moduleKey = this.activeModule) {
      const group = this.getModuleGroups(moduleKey).find(item => item.id === groupId)
      if (!group) {
        return
      }
      const itemIndex = group.items.findIndex(item => item.id === itemId)
      if (itemIndex < 0) {
        return
      }

      group.items.splice(itemIndex, 1)
      if (this.currentMediaId === itemId) {
        this.currentMediaId = group.items[itemIndex]?.id || group.items[itemIndex - 1]?.id || ''
      }
    },
    clearGroup() {
      if (!this.currentGroup.items.length || !window.confirm('确定清空当前分组吗？')) {
        return
      }
      this.currentGroup.items = []
      this.currentMediaId = ''
      this.warning = ''
    },
    playPrevious() {
      this.playByOffset(-1)
    },
    playNext() {
      if (this.playMode === 'single') {
        this.replayCurrent()
        return
      }
      if (this.playMode === 'random') {
        this.playRandom()
        return
      }
      this.playByOffset(1)
    },
    playByOffset(offset) {
      if (!this.currentGroup.items.length) {
        return
      }

      const currentIndex = this.currentGroup.items.findIndex(item => item.id === this.currentMediaId)
      let nextIndex = currentIndex + offset
      if (nextIndex < 0) {
        nextIndex = this.currentGroup.items.length - 1
      }
      if (nextIndex >= this.currentGroup.items.length) {
        nextIndex = 0
      }
      this.playItem(this.currentGroup.items[nextIndex].id)
    },
    playRandom() {
      if (!this.currentGroup.items.length) {
        return
      }
      if (this.currentGroup.items.length === 1) {
        this.replayCurrent()
        return
      }
      const candidates = this.currentGroup.items.filter(item => item.id !== this.currentMediaId)
      const nextItem = candidates[Math.floor(Math.random() * candidates.length)]
      this.playItem(nextItem.id)
    },
    replayCurrent() {
      const player = this.getPlayer()
      if (!player) {
        return
      }
      player.currentTime = 0
      player.play()
      this.isPlaying = true
    },
    togglePlay() {
      const player = this.getPlayer()
      if (!player) {
        return
      }
      if (player.paused) {
        player.play()
        this.isPlaying = true
      } else {
        player.pause()
        this.isPlaying = false
      }
    },
    seekBy(seconds) {
      const player = this.getPlayer()
      if (player) {
        player.currentTime = Math.max(0, player.currentTime + seconds)
      }
    },
    changeVolume(delta) {
      this.volume = Math.min(1, Math.max(0, Number((this.volume + delta).toFixed(2))))
    },
    toggleFullscreen() {
      const player = this.getPlayer()
      if (!player) {
        return
      }
      const requestFullscreen = player.requestFullscreen || player.webkitRequestFullscreen || player.msRequestFullscreen
      if (requestFullscreen) {
        requestFullscreen.call(player)
      }
    },
    changeSpeed(event) {
      this.playbackRate = Number(this.speedOptions[event.detail.value])
      this.syncPlaybackRate()
    },
    syncPlaybackRate() {
      const player = this.getPlayer()
      if (player) {
        player.playbackRate = this.playbackRate
      }
    },
    syncVolume() {
      const player = this.getPlayer()
      if (player) {
        player.volume = this.volume
      }
    },
    handlePlay() {
      this.isPlaying = true
      this.syncPlaybackRate()
    },
    handlePause() {
      this.isPlaying = false
    },
    togglePlayMode() {
      const currentIndex = playModes.indexOf(this.playMode)
      this.playMode = playModes[(currentIndex + 1) % playModes.length]
    },
    rememberProgress() {
      const player = this.getPlayer()
      if (!player || !this.currentMediaId || !Number.isFinite(player.duration)) {
        return
      }
      if (player.currentTime < 3 || player.duration - player.currentTime < 5) {
        delete this.progressMap[this.currentMediaId]
      } else {
        this.progressMap = {
          ...this.progressMap,
          [this.currentMediaId]: Math.floor(player.currentTime),
        }
      }
    },
    restoreProgress() {
      const player = this.getPlayer()
      const progress = this.progressMap[this.currentMediaId]
      if (player && progress) {
        player.currentTime = progress
      }
    },
    getProgressText(itemId) {
      const seconds = this.progressMap[itemId]
      if (!seconds) {
        return ''
      }
      return `上次 ${this.formatTime(seconds)}`
    },

    formatTime(totalSeconds) {
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    },
    handleShortcut(event) {
      const tagName = event.target?.tagName?.toLowerCase()
      if (['input', 'textarea'].includes(tagName)) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        this.togglePlay()
      }
      if (event.code === 'ArrowLeft') {
        this.seekBy(-10)
      }
      if (event.code === 'ArrowRight') {
        this.seekBy(10)
      }
      if (event.code === 'ArrowUp') {
        event.preventDefault()
        this.changeVolume(0.1)
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault()
        this.changeVolume(-0.1)
      }
      if (event.code === 'KeyF') {
        this.toggleFullscreen()
      }
    },
    saveState() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          library: this.library,
          activeModule: this.activeModule,
          activeGroupId: this.activeGroupId,
          currentMediaId: this.currentMediaId,
          playbackRate: this.playbackRate,
          playMode: this.playMode,
          volume: this.volume,
          progressMap: this.progressMap,
        }))
      } catch (error) {
        this.warning = '本地保存失败，可能是存储空间不足或当前环境限制。'
      }
    },
    restoreState() {
      try {
        const state = JSON.parse(localStorage.getItem(storageKey) || '{}')
        this.library = normalizeLibrary(state.library)
        this.activeModule = state.activeModule || this.activeModule
        this.activeGroupId = this.library[this.activeModule]?.some(group => group.id === state.activeGroupId) ? state.activeGroupId : this.library[this.activeModule][0].id
        this.currentMediaId = this.currentGroup.items.some(item => item.id === state.currentMediaId) ? state.currentMediaId : ''
        this.playbackRate = speedOptions.includes(String(state.playbackRate)) ? state.playbackRate : this.playbackRate
        this.playMode = playModes.includes(state.playMode) ? state.playMode : this.playMode
        this.volume = typeof state.volume === 'number' ? Math.min(1, Math.max(0, state.volume)) : this.volume
        this.progressMap = state.progressMap || {}
        this.expandedModules[this.activeModule] = true
        this.expandedGroups[this.activeGroupId] = true
      } catch (error) {
        this.warning = '读取本地播放数据失败，已使用默认媒体库。'
      }
    },
    getPlayer() {
      // H5 / Electron 下 uni-app 的 video 组件 ref 不是原生 HTMLVideoElement，
      // 直接调用 ref.pause() 可能无效；这里优先取内部原生 video 节点。
      // App 端可继续补充 uni.createVideoContext('playerRef', this) 的平台适配。
      const nativePlayer = typeof document !== 'undefined' ? document.querySelector('.player video, video.player') : null
      if (nativePlayer) {
        return nativePlayer
      }

      const playerRef = this.$refs.playerRef
      return Array.isArray(playerRef) ? playerRef[0] : playerRef
    },
    getFormatWarning(ext) {
      if (!ext) {
        return ''
      }
      if (ext === 'm3u8') {
        return 'M3U8 依赖运行环境原生支持；Windows 可后续接入 hls.js 增强，安卓端建议优先使用 MP4。'
      }
      if (!audioExts.includes(ext) && !videoExts.includes(ext)) {
        return '该格式不在常用支持列表中，能否播放取决于系统和 Chromium 解码能力。'
      }
      if (['avi', 'mkv', 'flac'].includes(ext)) {
        return '该格式能否播放取决于系统和 Chromium 解码能力；MP4/MP3 兼容性最好。'
      }
      return ''
    },
    handleError() {
      this.warning = '当前文件无法播放，可能是编码格式不受支持或文件已损坏。'
    },
  },
}
</script>

<style>
page {
  height: 100%;
  overflow: hidden;
  background: #070b14;
}

button::after {
  border: 0;
}

button {
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
}

button:active {
  transform: scale(0.97);
}

.app-shell {
  height: 100vh;
  display: flex;
  overflow: hidden;
  color: #f7f9ff;

}

.group-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx;
  margin-bottom: 14rpx;
  overflow: hidden;
  border: 1px solid rgba(83, 136, 255, 0.72);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.052);
}



.media-children {
  padding: 0 0 8rpx 34rpx;
}

.tree-main {
  min-width: 0;
  flex: 1;
}

.group-marker {
  width: 10rpx;
  height: 64rpx;
  border-radius: 99rpx;
  background: rgba(255, 255, 255, 0.16);
}

.group-item.active .group-marker {
  background: linear-gradient(180deg, #78a7ff, #8b5cf6);
  box-shadow: 0 0 26rpx rgba(96, 165, 250, 0.45);
}

.group-actions {
  display: flex;
  gap: 10rpx;
}

.mini-button {
  flex: 1;
  padding: 0 10rpx;
  color: #b9c7e6;
  background: rgba(255, 255, 255, 0.07);
  font-size: 20rpx;
  line-height: 2.15;
}

.mini-button.danger,
.remove-button {
  color: #ffb0b0;
  background: rgba(255, 93, 93, 0.1);
}

.mini-button.add {
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.12);
}

.move-button {
  padding: 0 14rpx;
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.12);
  font-size: 20rpx;
}

.group-name {
  margin-bottom: 8rpx;
  font-size: 28rpx;

}
.group-count{
  margin-left:24rpx;
    margin-bottom: 8rpx;
  font-size: 28rpx;

}
.main-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  box-sizing: border-box;
  padding: 36rpx;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
}

.topbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 30rpx;
}

.page-title {
  margin-bottom: 8rpx;
  font-size: 40rpx;
  font-weight: 900;
  letter-spacing: 0.4rpx;
}

.topbar-actions {
  display: flex;
  gap: 14rpx;
}

.small-button,
.control-button {
  padding: 0 24rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.08);
}

.content-grid {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(360rpx, 3fr);
  gap: 30rpx;
  align-items: stretch;
  height: auto;
  min-height: 0;
}

.right-panel {
  width: auto;
  min-height: 0;
  overflow: hidden;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  height: 100%;
}

.now-group-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  margin-bottom: 22rpx;
  padding: 24rpx 28rpx;
  overflow: hidden;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 28rpx;
  background:
    radial-gradient(circle at 8% 0%, rgba(59, 130, 246, 0.32), transparent 42%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.74));
  box-shadow: 0 20rpx 70rpx rgba(0, 0, 0, 0.24);
}

.eyebrow {
  margin-bottom: 8rpx;
  color: #8fb8ff;
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.now-group-name {
  max-width: 760rpx;
  overflow: hidden;
  color: #ffffff;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: 900;
}

.now-group-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  color: #c6d4ee;
  font-size: 23rpx;
}

.player-card,
.media-info,
.library-section {
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: linear-gradient(180deg, rgba(20, 28, 46, 0.78), rgba(12, 18, 31, 0.82));
  box-shadow: 0 28rpx 86rpx rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20rpx);
}

.player-card {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 0;
  background: #020617;
}

.empty-state {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  color: #d8e1f6;
  background:
    radial-gradient(circle at 50% 38%, rgba(47, 107, 255, 0.22), transparent 30%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent);
}

.empty-icon {
  width: 130rpx;
  height: 130rpx;
  border-radius: 42rpx;
  text-align: center;
  line-height: 130rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #3478ff, #8a5cff);
  box-shadow: 0 24rpx 58rpx rgba(52, 120, 255, 0.32);
  font-size: 52rpx;
}

.empty-title {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 800;
}

.empty-text {
  color: #9aa8c4;
  font-size: 24rpx;
}

.player-wrap,
.player {
  width: 100%;
  height: 100%;
}

.player-wrap {
  position: relative;
  overflow: hidden;
  background: #000000;
}

.player {
  display: block;
  background: #000000;
}

.player-top-overlay {
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  left: 0;
  padding: 26rpx 30rpx 88rpx;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.88), rgba(2, 6, 23, 0));
}

.player-badge {
  display: inline-block;
  width: fit-content;
  max-width: 420rpx;
  overflow: hidden;
  padding: 8rpx 16rpx;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999rpx;
  color: #dbeafe;
  background: rgba(15, 23, 42, 0.62);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22rpx;
  font-weight: 800;
}

.player-title {
  max-width: 82%;
  overflow: hidden;
  margin-top: 14rpx;
  color: #ffffff;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.55);
  font-size: 32rpx;
  font-weight: 900;
}

.player-bottom-fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  height: 120rpx;
  pointer-events: none;
  background: linear-gradient(0deg, rgba(2, 6, 23, 0.52), rgba(2, 6, 23, 0));
}

.audio-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 92rpx;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background:
    radial-gradient(circle, rgba(52, 120, 255, 0.3), transparent 50%),
    linear-gradient(135deg, rgba(124, 92, 255, 0.2), rgba(17, 24, 39, 0.2));
}

.audio-icon {
  width: 190rpx;
  height: 190rpx;
  border-radius: 54rpx;
  text-align: center;
  line-height: 190rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #3478ff, #8a5cff);
  box-shadow: 0 28rpx 70rpx rgba(52, 120, 255, 0.34);
  font-size: 84rpx;
}

.center-play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 5;
  width: 126rpx;
  height: 126rpx;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999rpx;
  color: #ffffff;
  background: rgba(15, 23, 42, 0.62);
  box-shadow: 0 20rpx 70rpx rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(14rpx);
  transform: translate(-50%, -50%);
  line-height: 126rpx;
  text-align: center;
  font-size: 48rpx;
  transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease;
}

.center-play-button.playing {
  opacity: 0.38;
}

.player-wrap:hover .center-play-button,
.center-play-button:active {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.04);
}

.control-bar {
  position: absolute;
  right: 28rpx;
  bottom: 30rpx;
  left: 28rpx;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  padding: 18rpx;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 28rpx;
  opacity: 0;
  pointer-events: none;
  transform: translateY(18rpx);
  background: rgba(15, 23, 42, 0.78);
  box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18rpx);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.player-wrap:hover .control-bar,
.control-bar:active {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.control-button {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  padding: 0;
  color: #e7eeff;
  text-align: center;
  line-height: 64rpx;
  font-size: 28rpx;
}

.control-button.play-control {
  width: 76rpx;
  height: 76rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 16rpx 36rpx rgba(37, 99, 235, 0.28);
  line-height: 76rpx;
  font-weight: 800;
}

.control-button.ghost {
  color: #b9c7e6;
  background: rgba(255, 255, 255, 0.055);
}

.tooltip-button::after {
  content: attr(data-tip);
  position: absolute;
  right: 50%;
  bottom: calc(100% + 14rpx);
  z-index: 6;
  width: max-content;
  max-width: 260rpx;
  padding: 10rpx 16rpx;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14rpx;
  opacity: 0;
  pointer-events: none;
  transform: translateX(50%) translateY(8rpx);
  color: #eef4ff;
  background: rgba(2, 6, 23, 0.9);
  box-shadow: 0 12rpx 34rpx rgba(0, 0, 0, 0.24);
  line-height: 1.35;
  font-size: 22rpx;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tooltip-button:hover::after {
  opacity: 1;
  transform: translateX(50%) translateY(0);
}

.speed-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 18rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.075);
}

.volume-box {
  margin-left: auto;
}

.speed-label,
.speed-picker {
  color: #dbe6ff;
  font-size: 24rpx;
}

.speed-label {
  color: #91a0bf;
}

.speed-picker {
  min-width: 88rpx;
  line-height: 60rpx;
  text-align: center;
  font-weight: 700;
}

.media-info,
.library-section {
  margin-top: 24rpx;
  padding: 26rpx;
  border-radius: 26rpx;
}

.library-section {
  margin-top: 0;
}

.library-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  padding: 8rpx;
  margin-bottom: 18rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.05);
}

.library-tab {
  margin: 0;
  padding: 0 18rpx;
  border-radius: 15rpx;
  color: #b9c7e6;
  background: transparent;
  line-height: 2.35;
  font-size: 24rpx;
  font-weight: 800;
}

.library-tab.active {
  color: #ffffff;
  background: linear-gradient(135deg, #3478ff, #7c5cff);
  box-shadow: 0 12rpx 28rpx rgba(52, 120, 255, 0.24);
}

.module-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.icon-action {

  /* height: 64rpx; */
  /* padding: 8px 12px; */
  width:100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #3478ff, #7c5cff);
  line-height: 64rpx;
  font-size: 34rpx;
  font-weight: 800;
}


.media-name {
  margin-bottom: 10rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.media-path {
  word-break: break-all;
  line-height: 1.55;
}

.warning {
  margin-top: 16rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  color: #ffe3a3;
  background: rgba(255, 209, 102, 0.1);
  font-size: 24rpx;
}

.library-section {
  height: 100%;
  box-sizing: border-box;
}

.library-tree {
  height: calc(100% - 136rpx);
  margin-top: 20rpx;
}

.playlist-header {
  margin-bottom: 20rpx;
}

.playlist-title {
  margin-bottom: 8rpx;
  font-size: 32rpx;
  font-weight: 900;
}

.search-input {
  height: 68rpx;
  box-sizing: border-box;
  margin-top: 18rpx;
  padding: 0 24rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18rpx;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.075);
  font-size: 24rpx;
}

.search-placeholder {
  color: #64728d;
}

.list-empty {
  padding: 54rpx 0;
  color: #92a0bb;
  text-align: center;
  font-size: 24rpx;
}

.list-empty.compact {
  padding: 20rpx 0 28rpx;
  text-align: left;
}

.media-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx;
  margin-bottom: 12rpx;
  border: 1px solid rgba(255, 255, 255, 0.065);
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.052);
}

.media-row.active {
  border-color: rgba(96, 150, 255, 0.68);
  background: linear-gradient(135deg, rgba(47, 107, 255, 0.28), rgba(124, 92, 255, 0.12));
  box-shadow: 0 14rpx 34rpx rgba(47, 107, 255, 0.13);
}

.media-index {
  width: 42rpx;
  height: 42rpx;
  border-radius: 14rpx;
  color: #a9b7d4;
  background: rgba(255, 255, 255, 0.07);
  text-align: center;
  line-height: 42rpx;
  font-size: 22rpx;
}

.media-row.active .media-index {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
}

.media-row-main {
  min-width: 0;
  flex: 1;
}

.media-row-name {
  overflow: hidden;
  margin-bottom: 6rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 24rpx;
  font-weight: 700;
}

.remove-button {
  padding: 0 14rpx;
  font-size: 20rpx;
}

@media screen and (min-width: 901px) {
  .small-button:hover,
  .library-tab:hover,
  .control-button:hover,
  .mini-button:hover,
  .remove-button:hover,
  .group-item:hover,
  .media-row:hover {
    transform: translateY(-2rpx);
  }

  .control-button:hover,
  .small-button:hover,
  .library-tab:hover {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.14);
  }
}

@media screen and (max-width: 900px) {
  page {
    height: auto;
    overflow: auto;
  }

  .app-shell {
    height: auto;
    min-height: 100vh;
    display: block;
    overflow: auto;
  }

  .group-item {
    min-width: 0;
  }

  .main-panel {
    display: block;
    height: auto;
    min-height: 100vh;
    overflow: visible;
    padding: 24rpx;
  }

  .topbar,
  .topbar-actions {
    display: block;
  }

  .topbar-actions .small-button {
    display: inline-block;
    margin-top: 14rpx;
    margin-right: 12rpx;
  }

  .content-grid {
    position: static;
    display: block;
    height: auto;
  }

  .right-panel {
    position: static;
    width: auto;
    min-width: 0;
    height: auto;
  }

  .player-card,
  .empty-state {
    height: auto;
    min-height: 430rpx;
  }

  .player-wrap,
  .player {
    height: 460rpx;
  }

  .library-section {
    height: auto;
    margin-top: 24rpx;
  }

  .library-tree {
    height: 520rpx;
  }
}
</style>
