## Pre-Release Manual Testing

### Auth Flow
- [ ] Register new account
- [ ] Login with existing account
- [ ] Logout
- [ ] Token refresh after 401
- [ ] Password validation works

### Session Flow
- [ ] Start session (all types)
- [ ] Pause session
- [ ] Resume session
- [ ] Stop session
- [ ] Cannot start second session while active
- [ ] Session persists on app minimize
- [ ] Session recovers after app kill

### Dashboard
- [ ] Loads without flicker
- [ ] Streak displays correctly
- [ ] Pull to refresh works
- [ ] Active session banner shows

### Stats
- [ ] Charts load correctly
- [ ] Filter switches work
- [ ] Data matches expectations

### Friends
- [ ] Can add friend
- [ ] Can view friend profile
- [ ] Leaderboard shows correctly
- [ ] Activity feed updates

### Profile
- [ ] Profile picture upload
- [ ] Settings changes persist
- [ ] Account deletion works
- [ ] Push token registration

### Offline
- [ ] Offline banner shows
- [ ] Graceful error messages
- [ ] Retry buttons work

### Performance
- [ ] App starts in <3 seconds
- [ ] Scrolling is smooth (60fps)
- [ ] No memory leaks in long sessions
