import { ArrowUpRight, Check, Circle, Command, Plus } from 'lucide-react'

const todayLabel = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date()).toUpperCase()

const navigation = [
  { label: 'Today', icon: Circle, active: true },
  { label: 'Habits', icon: Check, active: false },
]

function App() {
  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="Still home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>still</span>
        </a>

        <div className="workspace-label">PERSONAL SPACE</div>
        <nav className="nav-list">
          {navigation.map(({ label, icon: Icon, active }) => (
            <a
              className={`nav-item${active ? ' is-active' : ''}`}
              href={active ? '#today' : '#habits'}
              aria-current={active ? 'page' : undefined}
              key={label}
            >
              <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
              <span>{label}</span>
              {label === 'Today' && <span className="nav-shortcut">1</span>}
            </a>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="avatar" aria-hidden="true">Y</span>
          <span className="profile-name">Your space</span>
          <button className="icon-button" type="button" aria-label="Keyboard shortcuts">
            <Command size={15} strokeWidth={1.7} />
          </button>
        </div>
      </aside>

      <main className="main-panel" id="today">
        <header className="topbar">
          <div className="breadcrumb"><span>Personal space</span><span className="breadcrumb-divider">/</span><strong>Today</strong></div>
          <button className="button button-primary button-small" type="button">
            <Plus size={15} strokeWidth={1.8} />
            <span>New habit</span>
          </button>
        </header>

        <section className="welcome-section" aria-labelledby="page-title">
          <p className="eyebrow">{todayLabel}</p>
          <h1 id="page-title">A little, every day.</h1>
          <p className="welcome-copy">Make room for the things you want to become.</p>
        </section>

        <section className="empty-state" aria-label="Getting started">
          <div className="empty-mark" aria-hidden="true">
            <span className="empty-mark-ring" />
            <span className="empty-mark-dot" />
          </div>
          <h2>Your day starts here</h2>
          <p>Add a habit to make it part of your day.<br className="desktop-break" /> Small steps have a way of adding up.</p>
          <button className="button button-secondary" type="button">
            <Plus size={15} strokeWidth={1.8} />
            <span>Create your first habit</span>
            <ArrowUpRight className="button-trailing-icon" size={14} strokeWidth={1.8} />
          </button>
        </section>

        <footer className="page-footer">
          <span>Consistency, at your own pace.</span>
          <span className="footer-indicator"><span /> READY WHEN YOU ARE</span>
        </footer>
      </main>
    </div>
  )
}

export default App
