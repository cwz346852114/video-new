<template>
  <view class="app-shell" @dragover.prevent @drop.prevent="handleDrop">
    <view class="sidebar">
      <view class="brand">
        <text class="brand-name">Uni Video</text>
        <text class="brand-desc">本地音视频媒体库</text>
      </view>

      <view class="module-tabs">
        <button v-for="module in modules" :key="module.key" class="module-tab" :class="{ active: activeModule === module.key }" @click="switchModule(module.key)">
          {{ module.label }}
        </button>
      </view>

      <view class="sidebar-actions">
        <button class="action-button" @click="createGroup">新建分组</button>
        <button class="action-button primary" @click="addFiles">添加到当前分组</button>
      </view>

      <view class="group-summary">
        <text class="summary-label">分组总览</text>
        <text class="summary-value">{{ currentGroups.length }} 个分组 · {{ currentModuleFileCount }} 个文件</text>
      </view>

      <scroll-view class="group-list" scroll-y>
        <view v-for="group in currentGroups" :key="group.id" class="group-item" :class="{ active: group.id === activeGroupId }" @click="selectGroup(group.id)">
          <view class="group-marker"></view>
          <view>
            <text class="group-name">{{ group.name }}</text>
            <text class="group-count">{{ group.items.length }} 个文件 · {{ getGroupDurationText(group) }}</text>
          </view>
          <view class="group-actions">
            <button class="mini-button" @click.stop="renameGroup(group.id)">重命名</button>
            <button class="mini-button danger" @click.stop="deleteGroup(group.id)">删除</button>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="main-panel">
      <view class="topbar">
        <view>
          <text class="page-title">{{ activeModuleLabel }} / {{ currentGroup.name }}</text>
          <text class="page-subtitle">当前只播放「{{ currentGroup.name }}」内的文件；切换分组会切换播放队列。</text>
        </view>
        <view class="topbar-actions">
          <button class="small-button" @click="togglePlayMode">播放模式：{{ playModeLabel }}</button>
          <button class="small-button" @click="clearGroup">清空分组</button>
        </view>
      </view>

      <view class="content-grid">
        <view class="player-section">
          <view class="now-group-card">
            <view>
              <text class="eyebrow">当前分组</text>
              <text class="now-group-name">{{ currentGroup.name }}</text>
            </view>
            <view class="now-group-stats">
              <text>{{ currentGroup.items.length }} 个文件</text>
              <text>{{ activeQueueText }}</text>
            </view>
          </view>

          <view class="player-card">
            <view v-if="!currentMedia" class="empty-state">
              <text class="empty-icon">▶</text>
              <text class="empty-title">给「{{ currentGroup.name }}」添加文件</text>
              <text class="empty-text">添加或拖入文件后，只会进入当前分组，并按该分组列表播放。</text>
            </view>

            <view v-else class="player-wrap">
              <view class="player-top-overlay">
                <text class="player-badge">{{ currentGroup.name }}</text>
                <text class="player-title">{{ currentMedia.name }}</text>
              </view>
              <video
                ref="playerRef"
                class="player"
                :src="currentMedia.url"
                controls
                autoplay
                @ended="playNext"
                @error="handleError"
                @play="syncPlaybackRate"
                @timeupdate="rememberProgress"
                @loadedmetadata="syncPlaybackRate"
              ></video>
              <view v-if="currentMedia.kind === 'audio'" class="audio-overlay">
                <text class="audio-icon">♪</text>
              </view>
              <view class="player-bottom-fade"></view>
            </view>
          </view>

          <view class="control-bar">
            <button class="control-button ghost" @click="seekBy(-10)">-10s</button>
            <button class="control-button" @click="playPrevious">上一首</button>
            <button class="control-button play-control" @click="togglePlay">播放 / 暂停</button>
            <button class="control-button" @click="playNext">下一首</button>
            <button class="control-button ghost" @click="seekBy(10)">+10s</button>
            <button class="control-button ghost" @click="changeVolume(-0.1)">音量-</button>
            <button class="control-button ghost" @click="changeVolume(0.1)">音量+</button>
            <button class="control-button ghost" @click="toggleFullscreen">全屏</button>
            <view class="speed-box">
              <text class="speed-label">倍速</text>
              <picker :value="speedIndex" :range="speedOptions" @change="changeSpeed">
                <view class="speed-picker">{{ playbackRate }}x</view>
              </picker>
            </view>
            <view class="speed-box">
              <text class="speed-label">音量</text>
              <text class="speed-picker">{{ volumePercent }}%</text>
            </view>
          </view>

          <view v-if="currentMedia" class="media-info">
            <text class="media-name">正在播放：{{ currentMedia.name }}</text>
            <text class="media-path">{{ currentMedia.path }}</text>
            <text v-if="currentProgressText" class="media-path">已记忆进度：{{ currentProgressText }}</text>
            <text v-if="warning" class="warning">{{ warning }}</text>
          </view>
        </view>

        <view class="playlist-section">
          <view class="playlist-header">
            <text class="playlist-title">{{ currentGroup.name }} · 播放队列</text>
            <text class="playlist-tip">{{ currentGroup.items.length }} 个文件，{{ playModeLabel }}播放。添加文件会进入当前分组。</text>
            <input class="search-input" v-model="searchKeyword" placeholder="搜索文件名或路径" placeholder-class="search-placeholder" />
          </view>

          <scroll-view class="playlist" scroll-y>
            <view v-if="currentGroup.items.length === 0" class="list-empty">当前分组还没有文件</view>
            <view v-else-if="filteredItems.length === 0" class="list-empty">没有匹配的文件</view>
            <view v-for="item in filteredItems" :key="item.id" class="media-row" :class="{ active: item.id === currentMediaId }" @click="playItem(item.id)">
              <text class="media-index">{{ getItemIndex(item.id) + 1 }}</text>
              <view class="media-row-main">
                <text class="media-row-name">{{ item.name }}</text>
                <text class="media-row-meta">{{ item.ext.toUpperCase() }} · {{ item.kind === 'audio' ? '音频' : '视频' }}{{ getProgressText(item.id) ? ` · ${getProgressText(item.id)}` : '' }}</text>
              </view>
              <button class="move-button" @click.stop="moveItemToGroup(item.id)">移动</button>
              <button class="remove-button" @click.stop="removeItem(item.id)">移除</button>
            </view>
          </scroll-view>
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
      searchKeyword: '',
      warning: '',
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
    volumePercent() {
      return Math.round(this.volume * 100)
    },
    filteredItems() {
      const keyword = this.searchKeyword.trim().toLowerCase()
      if (!keyword) {
        return this.currentGroup.items
      }
      return this.currentGroup.items.filter(item => `${item.name} ${item.path}`.toLowerCase().includes(keyword))
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
    switchModule(moduleKey) {
      this.activeModule = moduleKey
      this.activeGroupId = this.library[moduleKey][0].id
      this.currentMediaId = this.currentGroup.items[0]?.id || ''
      this.warning = ''
    },
    renameGroup(groupId) {
      const group = this.currentGroups.find(item => item.id === groupId)
      if (!group) {
        return
      }
      const groupName = window.prompt('请输入新的分组名称', group.name)?.trim()
      if (groupName) {
        group.name = groupName
      }
    },
    deleteGroup(groupId) {
      if (this.currentGroups.length <= 1) {
        this.warning = '至少需要保留一个分组。'
        return
      }
      const group = this.currentGroups.find(item => item.id === groupId)
      if (!group || !window.confirm(`确定删除「${group.name}」吗？`)) {
        return
      }
      this.library[this.activeModule] = this.currentGroups.filter(item => item.id !== groupId)
      if (this.activeGroupId === groupId) {
        this.activeGroupId = this.library[this.activeModule][0].id
        this.currentMediaId = ''
      }
    },
    selectGroup(groupId) {
      this.activeGroupId = groupId
      this.currentMediaId = this.currentGroup.items[0]?.id || ''
      this.warning = ''
    },
    createGroup() {
      const defaultName = this.activeModule === 'video' ? '视频分组' : '音频分组'
      const groupName = window.prompt('请输入分组名称', `${defaultName}${this.currentGroups.length + 1}`)
      if (!groupName) {
        return
      }

      const group = {
        id: `${this.activeModule}-${Date.now()}`,
        name: groupName.trim(),
        items: [],
      }
      this.library[this.activeModule].push(group)
      this.activeGroupId = group.id
    },
    async addFiles() {
      if (window.electronMedia) {
        const files = await window.electronMedia.openFiles()
        this.addMediaFiles(files)
        return
      }

      this.openBrowserFilePicker()
    },
    openBrowserFilePicker() {
      if (!document?.createElement) {
        this.warning = '当前平台暂不支持直接选择本地文件。'
        return
      }

      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = this.activeModule === 'audio' ? 'audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a' : 'video/*,.mp4,.avi,.m3u8,.mov,.mkv,.webm'
      input.style.display = 'none'
      input.addEventListener('change', event => {
        const files = Array.from(event.target.files || []).map(file => this.toBrowserMediaFile(file))
        this.addMediaFiles(files)
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
    addMediaFiles(files) {
      if (!files.length) {
        return
      }

      const normalizedFiles = files.map(file => ({
        ...file,
        kind: audioExts.includes(file.ext) ? 'audio' : 'video',
      }))
      const matchedFiles = normalizedFiles.filter(file => file.kind === this.activeModule)
      const skippedCount = normalizedFiles.length - matchedFiles.length

      if (matchedFiles.length) {
        this.currentGroup.items.push(...matchedFiles)
        if (!this.currentGroup.items.some(item => item.id === this.currentMediaId)) {
          this.playItem(matchedFiles[0].id)
        }
      }

      this.warning = skippedCount ? `已跳过 ${skippedCount} 个不属于当前${this.activeModuleLabel}模块的文件。` : this.getFormatWarning(matchedFiles[0]?.ext)
    },
    playItem(itemId) {
      this.currentMediaId = itemId
      this.warning = this.getFormatWarning(this.currentMedia?.ext)
    },
    getItemIndex(itemId) {
      return this.currentGroup.items.findIndex(item => item.id === itemId)
    },
    moveItemToGroup(itemId) {
      if (this.currentGroups.length <= 1) {
        this.warning = '请先新建其它分组，再移动文件。'
        return
      }

      const sourceIndex = this.currentGroup.items.findIndex(item => item.id === itemId)
      if (sourceIndex < 0) {
        return
      }

      const options = this.currentGroups
        .filter(group => group.id !== this.activeGroupId)
        .map((group, index) => `${index + 1}. ${group.name}`)
        .join('\n')
      const selectedNumber = Number(window.prompt(`移动到哪个分组？\n${options}`))
      const targetGroup = this.currentGroups.filter(group => group.id !== this.activeGroupId)[selectedNumber - 1]
      if (!targetGroup) {
        return
      }

      const [item] = this.currentGroup.items.splice(sourceIndex, 1)
      targetGroup.items.push(item)
      if (this.currentMediaId === itemId) {
        this.currentMediaId = this.currentGroup.items[sourceIndex]?.id || this.currentGroup.items[sourceIndex - 1]?.id || ''
      }
      this.warning = `已移动到「${targetGroup.name}」。`
    },
    removeItem(itemId) {
      const itemIndex = this.currentGroup.items.findIndex(item => item.id === itemId)
      if (itemIndex < 0) {
        return
      }

      this.currentGroup.items.splice(itemIndex, 1)
      if (this.currentMediaId === itemId) {
        this.currentMediaId = this.currentGroup.items[itemIndex]?.id || this.currentGroup.items[itemIndex - 1]?.id || ''
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
    },
    togglePlay() {
      const player = this.getPlayer()
      if (!player) {
        return
      }
      if (player.paused) {
        player.play()
      } else {
        player.pause()
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
    getGroupDurationText(group) {
      const progressCount = group.items.filter(item => this.progressMap[item.id]).length
      if (!group.items.length) {
        return '空分组'
      }
      return progressCount ? `${progressCount} 个有进度` : '未播放'
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
      } catch (error) {
        this.warning = '读取本地播放数据失败，已使用默认媒体库。'
      }
    },
    getPlayer() {
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
  min-height: 100vh;
  display: flex;
  color: #f7f9ff;
  background:
    radial-gradient(circle at 14% 0%, rgba(57, 119, 255, 0.36), transparent 30%),
    radial-gradient(circle at 88% 12%, rgba(152, 93, 255, 0.18), transparent 28%),
    linear-gradient(135deg, #070b14 0%, #0b1020 52%, #111827 100%);
}

.sidebar {
  width: 340rpx;
  box-sizing: border-box;
  padding: 38rpx 24rpx;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.94), rgba(8, 13, 24, 0.9));
  box-shadow: 18rpx 0 70rpx rgba(0, 0, 0, 0.28);
}

.brand {
  position: relative;
  margin-bottom: 34rpx;
  padding: 26rpx 24rpx;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 26rpx;
  background: linear-gradient(135deg, rgba(47, 107, 255, 0.32), rgba(138, 92, 255, 0.16));
  box-shadow: 0 18rpx 42rpx rgba(47, 107, 255, 0.16);
}

.brand::after {
  content: '';
  position: absolute;
  top: -42rpx;
  right: -38rpx;
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.brand-name,
.brand-desc,
.page-title,
.page-subtitle,
.group-name,
.group-count,
.eyebrow,
.now-group-name,
.now-group-stats text,
.player-badge,
.player-title,
.playlist-title,
.playlist-tip,
.media-row-name,
.media-row-meta,
.media-name,
.media-path,
.warning,
.empty-title,
.empty-text {
  display: block;
}

.brand-name {
  position: relative;
  font-size: 38rpx;
  font-weight: 900;
  letter-spacing: 0.5rpx;
}

.brand-desc,
.page-subtitle,
.group-count,
.playlist-tip,
.media-row-meta,
.media-path {
  color: #92a0bb;
  font-size: 22rpx;
}

.brand-desc {
  position: relative;
  margin-top: 8rpx;
  color: #dbe6ff;
}

.module-tabs {
  display: flex;
  gap: 12rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.05);
}

.module-tab,
.action-button,
.small-button,
.control-button,
.move-button,
.remove-button,
.mini-button {
  margin: 0;
  color: #dce7ff;
  background: rgba(255, 255, 255, 0.075);
  border-radius: 16rpx;
  font-size: 24rpx;
  line-height: 2.45;
}

.module-tab {
  flex: 1;
  background: transparent;
}

.module-tab.active,
.action-button.primary {
  color: #ffffff;
  background: linear-gradient(135deg, #3478ff, #7c5cff);
  box-shadow: 0 16rpx 34rpx rgba(52, 120, 255, 0.28);
}

.action-button {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.group-summary {
  padding: 18rpx;
  margin-bottom: 20rpx;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 20rpx;
  background: rgba(37, 99, 235, 0.1);
}

.summary-label,
.summary-value {
  display: block;
}

.summary-label {
  margin-bottom: 6rpx;
  color: #8fb8ff;
  font-size: 20rpx;
  font-weight: 800;
}

.summary-value {
  color: #dbeafe;
  font-size: 23rpx;
}

.group-list {
  height: calc(100vh - 390rpx);
}

.group-item {
  position: relative;
  display: grid;
  grid-template-columns: 10rpx minmax(0, 1fr);
  column-gap: 16rpx;
  padding: 22rpx;
  margin-bottom: 14rpx;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.052);
}

.group-marker {
  width: 10rpx;
  height: 64rpx;
  border-radius: 99rpx;
  background: rgba(255, 255, 255, 0.16);
}

.group-item.active {
  border-color: rgba(83, 136, 255, 0.72);
  background: linear-gradient(135deg, rgba(47, 107, 255, 0.3), rgba(124, 92, 255, 0.13));
  box-shadow: 0 16rpx 38rpx rgba(0, 0, 0, 0.16);
}

.group-item.active .group-marker {
  background: linear-gradient(180deg, #78a7ff, #8b5cf6);
  box-shadow: 0 0 26rpx rgba(96, 165, 250, 0.45);
}

.group-actions {
  grid-column: 2;
  display: flex;
  gap: 10rpx;
  margin-top: 16rpx;
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

.move-button {
  padding: 0 14rpx;
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.12);
  font-size: 20rpx;
}

.group-name {
  margin-bottom: 8rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.main-panel {
  flex: 1;
  box-sizing: border-box;
  padding: 36rpx;
}

.topbar {
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) 480rpx;
  gap: 30rpx;
  align-items: start;
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
.playlist-section {
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: linear-gradient(180deg, rgba(20, 28, 46, 0.78), rgba(12, 18, 31, 0.82));
  box-shadow: 0 28rpx 86rpx rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20rpx);
}

.player-card {
  min-height: 650rpx;
  overflow: hidden;
  border-radius: 38rpx;
  background: #020617;
}

.empty-state {
  min-height: 650rpx;
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
  height: 720rpx;
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

.control-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 24rpx;
  padding: 18rpx;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 28rpx;
  background: rgba(15, 23, 42, 0.68);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.control-button {
  color: #e7eeff;
}

.control-button.play-control {
  min-width: 178rpx;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 16rpx 36rpx rgba(37, 99, 235, 0.28);
  font-weight: 800;
}

.control-button.ghost {
  color: #b9c7e6;
  background: rgba(255, 255, 255, 0.055);
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
.playlist-section {
  margin-top: 24rpx;
  padding: 26rpx;
  border-radius: 26rpx;
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

.playlist-section {
  height: 824rpx;
  box-sizing: border-box;
  margin-top: 0;
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

.playlist {
  height: 696rpx;
}

.list-empty {
  padding: 54rpx 0;
  color: #92a0bb;
  text-align: center;
  font-size: 24rpx;
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
  .module-tab:hover,
  .action-button:hover,
  .small-button:hover,
  .control-button:hover,
  .mini-button:hover,
  .remove-button:hover,
  .group-item:hover,
  .media-row:hover {
    transform: translateY(-2rpx);
  }

  .control-button:hover,
  .small-button:hover,
  .action-button:hover {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.14);
  }
}

@media screen and (max-width: 900px) {
  .app-shell {
    display: block;
  }

  .sidebar {
    width: auto;
    padding: 24rpx;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .brand {
    margin-bottom: 20rpx;
  }

  .sidebar-actions {
    flex-direction: row;
  }

  .action-button {
    flex: 1;
  }

  .group-list {
    height: 160rpx;
    white-space: nowrap;
  }

  .group-item {
    display: inline-block;
    min-width: 230rpx;
    margin-right: 12rpx;
    vertical-align: top;
  }

  .main-panel {
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
    display: block;
  }

  .player-card,
  .empty-state {
    min-height: 430rpx;
  }

  .player-wrap,
  .player {
    height: 460rpx;
  }

  .playlist-section {
    height: auto;
    margin-top: 24rpx;
  }

  .playlist {
    height: 520rpx;
  }
}
</style>



