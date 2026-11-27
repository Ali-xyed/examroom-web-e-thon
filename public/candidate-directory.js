import {examRequest} from './api.js'

export async function candidateDirectory(examId, {safe, notify}) {
  const container = document.querySelector('#candidate-directory')
  if (!container) return
  container.innerHTML = '<p class="muted" role="status">Loading candidates…</p>'
  try {
    let candidates = await examRequest('candidate_directory', {examId})
    if (!container.isConnected) return
    container.innerHTML = `<div class="candidate-directory-tools">
      <label>Search candidates<input id="candidate-search" type="search" placeholder="Search by name or email" autocomplete="off"></label>
      <label>Show<select id="candidate-filter"><option value="all">All candidates</option><option value="available">Available to enroll</option><option value="enrolled">Enrolled in this exam</option></select></label>
      </div><p class="muted directory-count" id="candidate-count" role="status"></p><div id="candidate-list" class="candidate-directory-list"></div><p class="form-error" id="directory-error" role="alert"></p>`
    const search = container.querySelector('#candidate-search')
    const filter = container.querySelector('#candidate-filter')
    const list = container.querySelector('#candidate-list')
    function render() {
      const term = search.value.trim().toLowerCase()
      const matches = candidates.filter(candidate =>
        (candidate.name+' '+candidate.email).toLowerCase().includes(term) &&
        (filter.value === 'all' || (filter.value === 'enrolled' ? candidate.enrolled : !candidate.enrolled && candidate.active)))
      container.querySelector('#candidate-count').textContent =
        candidates.filter(candidate => candidate.enrolled).length + ' enrolled · ' + matches.length + ' shown'
      list.innerHTML = matches.map(candidate => `<article class="candidate-entry">
        <div class="record-copy"><strong>${safe(candidate.name)}</strong><span class="record-description">${safe(candidate.email)}</span>
          ${!candidate.active ? '<span class="pill disabled">Disabled</span>' : ''}
          ${candidate.submittedAt ? '<small class="muted">Submitted '+safe(new Date(candidate.submittedAt).toLocaleString())+'</small>' : ''}
        </div>
        ${candidate.enrolled ? '<span class="pill available">'+(candidate.submittedAt ? 'Submitted' : candidate.startedAt ? 'In progress' : 'Enrolled')+'</span>' :
          '<button class="secondary" type="button" data-enroll="'+safe(candidate.email)+'" '+(!candidate.active?'disabled':'')+'>Enroll</button>'}
      </article>`).join('') || '<p class="empty-list">No candidates match this search.</p>'
    }
    search.oninput = render
    filter.onchange = render
    let busy = false
    list.onclick = async event => {
      const button = event.target.closest('[data-enroll]')
      if (!button || busy) return
      busy = true
      button.disabled = true
      button.textContent = 'Enrolling…'
      container.querySelector('#directory-error').textContent = ''
      try {
        await examRequest('enroll',{examId,email:button.dataset.enroll})
        candidates = await examRequest('candidate_directory',{examId})
        if (!container.isConnected) return
        render()
        search.focus({preventScroll:true})
        notify('Candidate enrolled.')
      } catch(error) {
        if (container.isConnected) {
          container.querySelector('#directory-error').textContent = error.message
          render()
        }
      } finally { busy = false }
    }
    render()
  } catch(error) {
    if (container.isConnected) container.innerHTML = '<p class="form-error" role="alert">'+safe(error.message)+'</p>'
  }
}
