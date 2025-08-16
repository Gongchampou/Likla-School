import React, { useEffect, useMemo, useState } from 'react';
import { User, Role } from '../types';
import { uploadUserAvatar, deleteByPath } from '../utils/storage';

interface ProfilePageProps {
  currentUser: User;
  onUpdateCurrentUser?: (user: User) => void;
  onBack: () => void;
  readOnly?: boolean;
}

const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start gap-3 py-1 text-sm">
    <div className="w-36 text-gray-500 dark:text-gray-400 font-medium">{label}</div>
    <div className="flex-1 break-words">{value ?? '—'}</div>
  </div>
);

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border">
    <div className="text-xs text-muted-foreground dark:text-dark-muted-foreground">{title}</div>
    <div className="mt-1 text-xl font-semibold">{value}</div>
  </div>
);

const Profile: React.FC<ProfilePageProps> = ({ currentUser, onUpdateCurrentUser, onBack, readOnly }) => {
  const [editMode, setEditMode] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [avatarPath, setAvatarPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [dataSharing, setDataSharing] = useState(false);
  const [locationText, setLocationText] = useState('NewYork - United States');
  const [badges, setBadges] = useState<string[]>(['Business', 'Product', 'Ai']);
  // Extended fields
  const [bloodGroup, setBloodGroup] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Derived role-based data (best-effort from optional fields)
  const attendanceRate = useMemo(() => {
    const anyUser: any = currentUser as any;
    const att = anyUser?.attendance;
    if (!att || typeof att !== 'object') return '—';
    const dates = Object.keys(att);
    if (!dates.length) return '—';
    const present = dates.filter(d => att[d] === 'Present').length;
    const pct = Math.round((present / dates.length) * 100);
    return `${pct}%`;
  }, [currentUser]);

  const feesSummary = useMemo(() => {
    const anyUser: any = currentUser as any;
    const fees = Array.isArray(anyUser?.fees) ? anyUser.fees : [];
    const unpaid = fees.filter((f: any) => f?.status === 'Unpaid');
    const amount = unpaid.reduce((sum: number, f: any) => sum + (Number(f?.amount) || 0), 0);
    return { count: unpaid.length, amount };
  }, [currentUser]);

  const unpaidFees = useMemo(() => {
    const anyUser: any = currentUser as any;
    const fees = Array.isArray(anyUser?.fees) ? anyUser.fees : [];
    return fees.filter((f: any) => f?.status === 'Unpaid').slice(0, 5);
  }, [currentUser]);

  // Best-effort recent attendance (latest 7 days)
  const recentAttendance = useMemo(() => {
    const anyUser: any = currentUser as any;
    const att = anyUser?.attendance;
    if (!att || typeof att !== 'object') return [] as Array<{ date: string; status: string }>; 
    const items = Object.keys(att).map(d => ({ date: d, status: String(att[d]) }));
    items.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    return items.slice(0, 7);
  }, [currentUser]);

  // Best-effort notices (from localStorage if present)
  const recentNotices = useMemo(() => {
    try {
      const raw = localStorage.getItem('notices');
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.slice(-5).reverse();
    } catch { return []; }
  }, []);

  // Teacher: today's schedule (best effort)
  const todayName = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long' }) as string, []);
  const todaySchedule = useMemo(() => {
    const arr = (currentUser as any)?.timetable;
    if (!Array.isArray(arr)) return [] as any[];
    return arr.filter((e: any) => e?.day === todayName).slice(0, 6);
  }, [currentUser, todayName]);

  useEffect(() => {
    const name = currentUser.name || '';
    setFirstName(name.split(' ')[0] || '');
    setLastName(name.split(' ').slice(1).join(' ') || '');
    setEmail(currentUser.email || '');
    setPhoto(currentUser.profilePicture || '');
    try {
      const perUserKey = `currentUserExtras:${currentUser.id}`;
      const raw = localStorage.getItem(perUserKey) || localStorage.getItem('currentUserExtras') || '{}';
      const extras = JSON.parse(raw);
      setUsername(extras.username || '');
      setMarketingEmails(!!extras.marketingEmails);
      setDataSharing(!!extras.dataSharing);
      setLocationText(extras.location || 'NewYork - United States');
      setBadges(extras.badges || ['Business', 'Product', 'Ai']);
      setAvatarPath(extras.avatarPath || '');
      setBloodGroup(extras.bloodGroup || '');
      setGender(extras.gender || '');
      setNationality(extras.nationality || '');
      setPhone(extras.phone || '');
      setAddress(extras.address || '');
      setFatherName(extras.fatherName || '');
      setFatherPhone(extras.fatherPhone || '');
      setMotherName(extras.motherName || '');
      setMotherPhone(extras.motherPhone || '');
      setEmergencyContactName(extras.emergencyContactName || '');
      setEmergencyContactPhone(extras.emergencyContactPhone || '');
      setMedicalNotes(extras.medicalNotes || '');
    } catch {}
  }, [currentUser]);

  const handleSave = () => {
    const mergedName = `${firstName}`.trim() + (lastName ? ` ${lastName.trim()}` : '');
    onUpdateCurrentUser?.({
      ...currentUser,
      name: mergedName || currentUser.name,
      email,
      profilePicture: photo || currentUser.profilePicture,
    });
    try {
      const perUserKey = `currentUserExtras:${currentUser.id}`;
      const payload = JSON.stringify({
        username,
        marketingEmails,
        dataSharing,
        location: locationText,
        badges,
        avatarPath,
        bloodGroup,
        gender,
        nationality,
        phone,
        address,
        fatherName,
        fatherPhone,
        motherName,
        motherPhone,
        emergencyContactName,
        emergencyContactPhone,
        medicalNotes,
      });
      localStorage.setItem(perUserKey, payload);
      // Remove legacy unscoped key to avoid cross-account leakage
      try { localStorage.removeItem('currentUserExtras'); } catch {}
    } catch {}
    setEditMode(false);
  };

  const handleDiscard = () => {
    // reset to original values
    const name = currentUser.name || '';
    setFirstName(name.split(' ')[0] || '');
    setLastName(name.split(' ').slice(1).join(' ') || '');
    setEmail(currentUser.email || '');
    setPhoto(currentUser.profilePicture || '');
    try {
      const perUserKey = `currentUserExtras:${currentUser.id}`;
      const raw = localStorage.getItem(perUserKey) || localStorage.getItem('currentUserExtras') || '{}';
      const extras = JSON.parse(raw);
      setUsername(extras.username || '');
      setMarketingEmails(!!extras.marketingEmails);
      setDataSharing(!!extras.dataSharing);
      setLocationText(extras.location || 'NewYork - United States');
      setBadges(extras.badges || ['Business', 'Product', 'Ai']);
      setAvatarPath(extras.avatarPath || '');
      setBloodGroup(extras.bloodGroup || '');
      setGender(extras.gender || '');
      setNationality(extras.nationality || '');
      setPhone(extras.phone || '');
      setAddress(extras.address || '');
      setFatherName(extras.fatherName || '');
      setFatherPhone(extras.fatherPhone || '');
      setMotherName(extras.motherName || '');
      setMotherPhone(extras.motherPhone || '');
      setEmergencyContactName(extras.emergencyContactName || '');
      setEmergencyContactPhone(extras.emergencyContactPhone || '');
      setMedicalNotes(extras.medicalNotes || '');
    } catch {}
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (readOnly || !editMode) return;
    setUploading(true);
    try {
      const { url, path } = await uploadUserAvatar(file, currentUser.id);
      // Replace local photo with uploaded URL
      setPhoto(url);
      // Delete previous avatar file if exists
      if (avatarPath && avatarPath !== path) {
        try { await deleteByPath(avatarPath); } catch {}
      }
      setAvatarPath(path);
    } catch (err) {
      console.error('Avatar upload failed', err);
    } finally {
      setUploading(false);
      // clear value so same file can be chosen again if needed
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="min-h-full w-full">
      {/* Cover */}
      <div className="h-44 sm:h-56 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/40"></div>

      {/* Header section */}
      <div className="max-w-6xl mx-auto px-4 -mt-16">
        <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative">
              <img
                src={photo || currentUser.profilePicture}
                alt="Avatar"
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-cover ring-4 ring-card dark:ring-dark-card"
              />
              {!readOnly && (
                <>
                  <button
                    onClick={() => setEditMode(true)}
                    className="absolute -bottom-2 right-2 px-3 py-1.5 text-xs rounded-full bg-primary text-white shadow"
                  >
                    Edit
                  </button>
                  {editMode && (
                    <div className="absolute -bottom-12 right-0 flex items-center gap-2">
                      <input id="avatarUpload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      <label htmlFor="avatarUpload" className="px-3 py-1.5 text-xs rounded-full border border-border dark:border-dark-border bg-card dark:bg-dark-card cursor-pointer">
                        {uploading ? 'Uploading…' : 'Change Photo'}
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{firstName || currentUser.name.split(' ')[0]} {lastName || currentUser.name.split(' ').slice(1).join(' ')}</h1>
                <span className="text-primary">✔</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground dark:text-dark-muted-foreground">
                <span>{email || currentUser.email}</span>
                <span>•</span>
                <span>{locationText}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded-full bg-muted dark:bg-dark-muted">{b}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <button onClick={onBack} className="px-3 py-2 rounded-md border text-sm">Back</button>
              {!readOnly && editMode && (
                <>
                  <button onClick={handleDiscard} className="px-3 py-2 rounded-md border text-sm">Discard</button>
                  <button onClick={() => setEditMode(false)} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
                  <button onClick={handleSave} className="px-3 py-2 rounded-md bg-primary text-white text-sm">Save</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: About / Contact */}
        <div className="space-y-6">
          <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">About</h3>
            <InfoRow label="Username" value={username || '—'} />
            <InfoRow label="Location" value={locationText} />
            <InfoRow label="Role" value={currentUser.role} />
          </div>
          <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Contact</h3>
            <InfoRow label="Email" value={email || currentUser.email} />
            <InfoRow label="Phone" value={phone || '—'} />
            <InfoRow label="Address" value={address || '—'} />
            <InfoRow label="Marketing Emails" value={marketingEmails ? 'Enabled' : 'Disabled'} />
            <InfoRow label="Data Sharing" value={dataSharing ? 'Enabled' : 'Disabled'} />
          </div>
          <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Personal Details</h3>
            <InfoRow label="Gender" value={gender || '—'} />
            <InfoRow label="Blood Group" value={bloodGroup || '—'} />
            <InfoRow label="Nationality" value={nationality || '—'} />
            <InfoRow label="Medical Notes" value={medicalNotes || '—'} />
          </div>
          <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Guardian Details</h3>
            <InfoRow label="Father Name" value={fatherName || '—'} />
            <InfoRow label="Father Phone" value={fatherPhone || '—'} />
            <InfoRow label="Mother Name" value={motherName || '—'} />
            <InfoRow label="Mother Phone" value={motherPhone || '—'} />
            <InfoRow label="Emergency Contact" value={emergencyContactName || '—'} />
            <InfoRow label="Emergency Phone" value={emergencyContactPhone || '—'} />
          </div>
          {/* Role-specific basic info */}
          {currentUser.role === Role.STUDENT && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Student Info</h3>
              <InfoRow label="Class" value={(currentUser as any)?.classId || '—'} />
              <InfoRow label="Display ID" value={currentUser.displayId || '—'} />
              <InfoRow label="DOB" value={currentUser.dob || '—'} />
              <InfoRow label="Discount" value={typeof (currentUser as any)?.discount === 'number' ? `${(currentUser as any).discount}%` : '—'} />
            </div>
          )}
          {currentUser.role === Role.TEACHER && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Teacher Info</h3>
              <InfoRow label="WhatsApp" value={(currentUser as any)?.whatsapp || '—'} />
              <InfoRow label="Salary" value={(currentUser as any)?.salary != null ? `$${(currentUser as any).salary}` : '—'} />
              <InfoRow label="DOB" value={currentUser.dob || '—'} />
            </div>
          )}
          {currentUser.role === Role.STAFF && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Staff Info</h3>
              <InfoRow label="Designation" value={(currentUser as any)?.designation || '—'} />
              <InfoRow label="DOB" value={currentUser.dob || '—'} />
            </div>
          )}
          {currentUser.role === Role.LIBRARIAN && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Librarian Info</h3>
              <InfoRow label="Library ID" value={(currentUser as any)?.libraryId || '—'} />
              <InfoRow label="DOB" value={currentUser.dob || '—'} />
            </div>
          )}
          {(currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN) && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Admin</h3>
              <p className="text-sm text-muted-foreground">Full access to manage users, classes, notices, fees, and settings.</p>
            </div>
          )}
        </div>

        {/* Right column: Quick stats and editable form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Attendance" value={attendanceRate} />
            <StatCard title="Assignments" value={(currentUser as any)?.assignmentsCount ?? '—'} />
            <StatCard title="Notices" value={(currentUser as any)?.noticesCount ?? '—'} />
            <StatCard title="Fees Due" value={feesSummary.amount ? `$${feesSummary.amount}` : '—'} />
          </div>

          {/* Student extras */}
          {currentUser.role === Role.STUDENT && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">Pending Fees</h3>
                {unpaidFees.length ? (
                  <ul className="space-y-2 text-sm">
                    {unpaidFees.map((f: any) => (
                      <li key={String(f.id)} className="flex items-center justify-between">
                        <span className="truncate mr-2">{f.title || 'Fee'}</span>
                        <span className="font-medium">${Number(f.amount || 0)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No pending fees</div>
                )}
              </div>
              <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">Recent Attendance</h3>
                {recentAttendance.length ? (
                  <ul className="space-y-2 text-sm">
                    {recentAttendance.map((a) => (
                      <li key={a.date} className="flex items-center justify-between">
                        <span>{a.date}</span>
                        <span className={a.status === 'Present' ? 'text-green-600' : a.status === 'Absent' ? 'text-red-600' : ''}>{a.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No attendance records</div>
                )}
              </div>
            </div>
          )}

          {/* Teacher extras */}
          {currentUser.role === Role.TEACHER && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-4">Today's Schedule ({todayName})</h3>
              {todaySchedule.length ? (
                <ul className="space-y-2 text-sm">
                  {todaySchedule.map((t: any) => (
                    <li key={String(t.id)} className="flex items-center justify-between">
                      <span className="truncate mr-2">{t.subject || 'Class'} • {t.classId || ''}</span>
                      <span className="font-medium">{t.timeSlot || ''}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">No entries for today</div>
              )}
            </div>
          )}

          {/* Admin / Super Admin: quick links (informational) */}
          {(currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN) && (
            <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-3">Quick Areas</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {['User Management', 'Class', 'Attendance', 'Assignment', 'Library', 'Fees', 'Settings', 'Notice / Announcements'].map(k => (
                  <span key={k} className="px-2 py-1 rounded-full border border-border dark:border-dark-border bg-muted dark:bg-dark-muted">{k}</span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Profile Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Avatar URL</label>
                <input
                  type="url"
                  value={photo}
                  onChange={e => setPhoto(e.target.value)}
                  disabled={readOnly || !editMode}
                  placeholder="https://..."
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Username</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={readOnly || !editMode}
                  placeholder="heythomas"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">First Name</label>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <input
                  value={locationText}
                  onChange={e => setLocationText(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Gender</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={e => setBloodGroup(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Nationality</label>
                <input
                  value={nationality}
                  onChange={e => setNationality(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Badges (comma separated)</label>
                <input
                  value={badges.join(', ')}
                  onChange={e => setBadges(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Father Name</label>
                <input
                  value={fatherName}
                  onChange={e => setFatherName(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Father Phone</label>
                <input
                  value={fatherPhone}
                  onChange={e => setFatherPhone(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Mother Name</label>
                <input
                  value={motherName}
                  onChange={e => setMotherName(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Mother Phone</label>
                <input
                  value={motherPhone}
                  onChange={e => setMotherPhone(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Emergency Contact Name</label>
                <input
                  value={emergencyContactName}
                  onChange={e => setEmergencyContactName(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Emergency Contact Phone</label>
                <input
                  value={emergencyContactPhone}
                  onChange={e => setEmergencyContactPhone(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Medical Notes</label>
                <textarea
                  value={medicalNotes}
                  onChange={e => setMedicalNotes(e.target.value)}
                  disabled={readOnly || !editMode}
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm disabled:opacity-60"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={marketingEmails} onChange={e => setMarketingEmails(e.target.checked)} disabled={readOnly || !editMode} />
                  <span className="font-medium">Marketing Emails</span>
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={dataSharing} onChange={e => setDataSharing(e.target.checked)} disabled={readOnly || !editMode} />
                  <span className="font-medium">Data Sharing</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notices (generic) */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Recent Notices</h3>
          {recentNotices.length ? (
            <ul className="space-y-2 text-sm">
              {recentNotices.map((n: any) => (
                <li key={String(n.id)} className="flex items-center justify-between">
                  <span className="truncate mr-2">{n.title || 'Notice'}</span>
                  <span className="text-muted-foreground">{n.date || ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">No recent notices</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
