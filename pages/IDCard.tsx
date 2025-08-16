import React, { useState, useMemo, useEffect } from 'react';
import { downloadElementAsPdf, warmupPdfLibs } from '../utils/pdf';
import { Role, AnyUser, Student as StudentType } from '../types';
import { SearchIcon, FileDownIcon, ClassIcon, QrCodeIcon } from '../components/icons';
import { stableDisplayIdForUser, formatDisplayId } from '../utils/id';
import { loadUsers } from '../utils/users';

// Class options are computed from users' classId values (no separate class store)


type CardLayout = 'classic' | 'side' | 'freeform';
interface CardStyle {
    primaryColor: string;
    showQr: boolean;
    avatarShape: 'circle' | 'rounded';
    layout: CardLayout;
    scale: number; // 0.8 - 1.4
    bgImage: string; // background image URL for card body
    logoUrl?: string; // optional logo for export
    footerAddress?: string; // optional address for export footer
    footerMobile?: string; // optional mobile for export footer
    // Export sizing/styling
    cardWidthMm?: number; // default 54
    cardHeightMm?: number; // default 85.6
    borderRadius?: number; // px
    logoHeight?: number; // px
    qrSizePx?: number; // pixel size for QR image (both display and export)
    qrMode?: 'embedded' | 'text' | 'url'; // embedded vCard, plain text, or app URL
    qrExtraText?: string; // additional free text to include in QR payload
    qrAutoSize?: boolean; // auto adjust QR size based on payload length
    forcePlainText?: boolean; // force plain-text mode for all cards
    compactText?: boolean; // use compact labels to shorten payload
    minimalText?: boolean; // only essential fields to maximize module size
    qrEcc?: 'L' | 'M' | 'Q' | 'H'; // error correction level
    qrMargin?: number; // quiet zone in modules
    photoBorderColor?: string; // css color
    photoBorderWidth?: number; // px
    signatureUrl?: string; // data URL or remote URL
    signatureLabel?: string; // e.g., Principal
    positions?: {
        avatar: { x: number; y: number };
        name: { x: number; y: number };
        id: { x: number; y: number };
        role: { x: number; y: number };
        class: { x: number; y: number };
        qr: { x: number; y: number };
    };
}

// Helper: build a QR image URL from data (CORS-friendly service)
function buildQrUrl(data: string, size: number = 96, ecc: 'L'|'M'|'Q'|'H' = 'M', margin: number = 8): string {
    const payload = encodeURIComponent(data || '');
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=${ecc}&margin=${Math.max(0, Math.min(20, margin))}&color=000000&bgcolor=ffffff&data=${payload}`;
}
// Helper: build a URL that opens this app with a Base64 user payload in the hash
function buildProfileUrl(payload: any): string {
    try {
        const json = JSON.stringify(payload);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        const { origin, pathname } = window.location;
        return `${origin}${pathname}#profile=${b64}`;
    } catch {
        const { origin, pathname } = window.location;
        return `${origin}${pathname}`;
    }
}

const IdCardComponent: React.FC<{ user: AnyUser, schoolName: string, styleConfig: CardStyle }> = ({ user, schoolName, styleConfig }) => {
    const originalStudent = user.role === Role.STUDENT ? user as StudentType : null;
    const [editMode, setEditMode] = useState(false);
    const [localName, setLocalName] = useState(user.name);
    const [localProfile, setLocalProfile] = useState(user.profilePicture);
    const [localDobYear, setLocalDobYear] = useState<string>((user as any).dobYear || '');
    const [localDob, setLocalDob] = useState<string>((user as any).dob || ''); // YYYY-MM-DD
    const [localSchoolName, setLocalSchoolName] = useState<string>(schoolName);
    const [localClassId, setLocalClassId] = useState<string>(originalStudent?.classId || '');

    const previewUser = useMemo<AnyUser>(() => ({
        ...user,
        name: localName,
        profilePicture: localProfile,
        ...(localDobYear ? { dobYear: localDobYear } : {}),
        ...(user.role === Role.STUDENT && localClassId ? { classId: localClassId } : {}),
    }), [user, localName, localProfile, localDobYear, localClassId]);

    const className = previewUser.role === Role.STUDENT
        ? ((previewUser as StudentType).classId || null)
        : null;

    // Extended profile extras (fallback to localStorage for current profile edits)
    const extras = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('currentUserExtras') || '{}') || {}; } catch { return {}; }
    }, []);
    const gender = (user as any).gender || extras.gender || '';
    const bloodGroup = (user as any).bloodGroup || extras.bloodGroup || '';
    const fatherName = (user as any).fatherName || extras.fatherName || '';
    const motherName = (user as any).motherName || extras.motherName || '';

    // Always format per rules (role code, initials, school initials, birth year if available)
    const cardId = useMemo(() => {
        const dobYear = (previewUser as any).dobYear as string | number | undefined;
        return formatDisplayId({ user: previewUser, schoolName: localSchoolName, dobYear });
    }, [previewUser, localSchoolName]);

    const resetEdits = () => {
        setLocalName(user.name);
        setLocalProfile(user.profilePicture);
        setLocalDobYear((user as any).dobYear || '');
        setLocalDob((user as any).dob || '');
        setLocalSchoolName(schoolName);
        setLocalClassId(originalStudent?.classId || '');
    };

    const headerStyle: React.CSSProperties = {
        backgroundColor: `${styleConfig.primaryColor}1A` // ~10% alpha
    };
    const borderStyle: React.CSSProperties = { borderColor: styleConfig.primaryColor };
    const rolePillStyle: React.CSSProperties = { color: styleConfig.primaryColor };
    const bodyStyle: React.CSSProperties = styleConfig.bgImage ? {
        backgroundImage: `url(${styleConfig.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
    } : {};

    const avatarClass = styleConfig.avatarShape === 'circle' ? 'rounded-full' : 'rounded-lg';
    const layoutIsSide = styleConfig.layout === 'side';
    const layoutIsFreeform = styleConfig.layout === 'freeform';

    // Compute the QR payload string used for the current card (for debug and URL)
    const qrData = useMemo(() => {
        // Build embedded vCard text (works offline and most scanners show/save contact)
        const buildEmbeddedText = () => {
            const name = (localName || previewUser.name || '').trim();
            const email = ((previewUser as any).email || '').toString().trim();
            const userTel = ((previewUser as any).whatsapp || '').toString().trim();
            const schoolTel = (styleConfig.footerMobile || '').toString().trim();
            const tel = userTel || schoolTel; // prefer user WhatsApp, else school mobile
            const roleStr = String(previewUser.role);
            const clsId = (previewUser as any).classId || '';
            const clsName = className || '';
            const displayId = (previewUser as any).displayId || '';
            const discount = previewUser.role === Role.STUDENT ? (previewUser as any).discount : undefined;
            const whatsapp = (previewUser as any).whatsapp;
            const salary = (previewUser as any).salary;
            const noteParts = [
                `UserID:${previewUser.id}`,
                `CardID:${cardId}`,
                clsId ? `ClassID:${clsId}` : '',
                clsName ? `Class:${clsName}` : '',
                displayId ? `DisplayID:${displayId}` : '',
                localDob ? `DOB:${localDob}` : '',
                localDobYear ? `Year:${localDobYear}` : '',
                typeof discount === 'number' ? `Discount:${discount}%` : '',
                whatsapp ? `WhatsApp:${whatsapp}` : '',
                typeof salary === 'number' ? `Salary:${salary}` : '',
                (styleConfig.qrExtraText || '').trim()
            ].filter(Boolean).join(' | ');
            // vCard requires CRLF line endings for best compatibility
            const CRLF = '\r\n';
            const lines = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${name}`,
                `N:${name};;;;`,
                `ORG:${localSchoolName}`,
                `TITLE:${roleStr}`,
                email ? `EMAIL:${email}` : '',
                // Always include a TEL for better scanner compatibility
                (tel || !email) ? `TEL;TYPE=CELL:${tel || schoolTel || '000'}` : '',
                noteParts ? `NOTE:${noteParts}` : '',
                'END:VCARD'
            ].filter(Boolean);
            return lines.join(CRLF);
        };
        // Build plain multi-line text for scanners that don't parse vCards
        const buildPlainText = () => {
            const name = (localName || previewUser.name || '').trim();
            const email = (previewUser as any).email || '';
            const tel = (previewUser as any).whatsapp || styleConfig.footerMobile || '';
            const roleStr = String(previewUser.role);
            const clsId = (previewUser as any).classId || '';
            const clsName = className || '';
            const displayId = (previewUser as any).displayId || '';
            const discount = previewUser.role === Role.STUDENT ? (previewUser as any).discount : undefined;
            const whatsapp = (previewUser as any).whatsapp;
            const salary = (previewUser as any).salary;
            if (styleConfig.minimalText) {
                // Shortest practical payload (essential fields only)
                const parts = [
                    `N:${name}`,
                    `R:${roleStr}`,
                    `S:${localSchoolName}`,
                    `CID:${cardId}`,
                    tel ? `T:${tel}` : ''
                ].filter(Boolean);
                const extra = (styleConfig.qrExtraText || '').trim();
                return extra ? parts.concat(extra).join(' | ') : parts.join(' | ');
            }
            if (styleConfig.compactText) {
                // Compact single-line payload with short labels
                const parts = [
                    `N:${name}`,
                    `R:${roleStr}`,
                    `S:${localSchoolName}`,
                    `CID:${cardId}`,
                    `UID:${previewUser.id}`,
                    displayId ? `DID:${displayId}` : '',
                    email ? `E:${email}` : '',
                    tel ? `T:${tel}` : '',
                    clsId ? `CLID:${clsId}` : '',
                    clsName ? `CL:${clsName}` : '',
                    localDob ? `DOB:${localDob}` : '',
                    localDobYear ? `Y:${localDobYear}` : '',
                    typeof discount === 'number' ? `Disc:${discount}%` : '',
                    whatsapp ? `WA:${whatsapp}` : '',
                    typeof salary === 'number' ? `Sal:${salary}` : '',
                    (styleConfig.qrExtraText || '').trim()
                ].filter(Boolean);
                return parts.join(' | ');
            } else {
                const lines = [
                    'LIKLA SCHOOL - ID PROFILE',
                    `Name: ${name}`,
                    `Role: ${roleStr}`,
                    `School: ${localSchoolName}`,
                    `Card ID: ${cardId}`,
                    `User ID: ${previewUser.id}`,
                    displayId ? `Display ID: ${displayId}` : '',
                    email ? `Email: ${email}` : '',
                    tel ? `Mobile: ${tel}` : '',
                    clsId ? `Class ID: ${clsId}` : '',
                    clsName ? `Class: ${clsName}` : '',
                    localDob ? `DOB: ${localDob}` : '',
                    localDobYear ? `Year: ${localDobYear}` : '',
                    typeof discount === 'number' ? `Discount: ${discount}%` : '',
                    whatsapp ? `WhatsApp: ${whatsapp}` : '',
                    typeof salary === 'number' ? `Salary: ${salary}` : '',
                    (styleConfig.qrExtraText || '').trim()
                ].filter(Boolean);
                return lines.join('\n');
            }
        };
        const data = styleConfig.forcePlainText
            ? buildPlainText()
            : (styleConfig.qrMode ?? 'embedded') === 'embedded'
                ? buildEmbeddedText()
                : (styleConfig.qrMode === 'text')
                    ? buildPlainText()
                    : buildProfileUrl({
                    id: previewUser.id,
                    role: previewUser.role,
                    name: localName || previewUser.name,
                    email: (previewUser as any).email,
                    profilePicture: localProfile || previewUser.profilePicture,
                    classId: (previewUser as any).classId,
                    cardId,
                    dob: localDob,
                    dobYear: localDobYear,
                    schoolName: localSchoolName,
                });
        return data;
    }, [styleConfig.forcePlainText, styleConfig.qrMode, previewUser.id, previewUser.role, localName, previewUser.name, (previewUser as any).email, localProfile, previewUser.profilePicture, (previewUser as any).classId, cardId, localDob, localDobYear, localSchoolName, className]);

    // Build the QR image URL from the payload
    const qrUrl = useMemo(() => {
        let size = Math.max(64, Math.min(512, styleConfig.qrSizePx ?? 120));
        if (styleConfig.qrAutoSize) {
            const n = qrData.length;
            // heuristic sizing by payload length
            if (n <= 150) size = Math.max(size, 160);
            else if (n <= 300) size = Math.max(size, 192);
            else if (n <= 600) size = Math.max(size, 224);
            else if (n <= 900) size = Math.max(size, 256);
            else if (n <= 1200) size = Math.max(size, 320);
            else size = 512;
        }
        // Choose ECC: default M; for very short data use Q/H; allow override
        let ecc: 'L'|'M'|'Q'|'H' = styleConfig.qrEcc || 'L';
        // Increase quiet zone for readability
        const margin = styleConfig.qrMargin ?? 8;
        return buildQrUrl(qrData, size, ecc, margin);
    }, [qrData, styleConfig.qrSizePx, styleConfig.qrAutoSize, styleConfig.qrEcc, styleConfig.qrMargin]);

    const DISPLAY_W = 320;
    const DISPLAY_H = 480;
    const qrDisplayPx = Math.max(64, Math.min(512, styleConfig.qrSizePx ?? 120));

    return (
        <div className="space-y-3">
            {editMode && (
                <div className="bg-muted dark:bg-dark-muted rounded-lg p-3 border border-border dark:border-dark-border">
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-xs font-medium">Full Name</label>
                            <input value={localName} onChange={e => setLocalName(e.target.value)} className="mt-1 w-full rounded-md border-border dark:border-dark-border bg-card dark:bg-dark-card p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium">Profile Picture URL</label>
                            <input value={localProfile} onChange={e => setLocalProfile(e.target.value)} className="mt-1 w-full rounded-md border-border dark:border-dark-border bg-card dark:bg-dark-card p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium">School Name</label>
                            <input value={localSchoolName} onChange={e => setLocalSchoolName(e.target.value)} className="mt-1 w-full rounded-md border-border dark:border-dark-border bg-card dark:bg-dark-card p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium">Date of Birth</label>
                            <input
                                type="date"
                                value={localDob}
                                onChange={e => {
                                    const v = e.target.value; // format: YYYY-MM-DD
                                    setLocalDob(v);
                                    const yr = v?.slice(0,4) || '';
                                    setLocalDobYear(yr);
                                }}
                                className="mt-1 w-full rounded-md border-border dark:border-dark-border bg-card dark:bg-dark-card p-2 text-sm"
                            />
                            <p className="mt-1 text-[10px] text-muted-foreground dark:text-dark-muted-foreground">Year is used for last 4 digits of the ID.</p>
                        </div>
                        {previewUser.role === Role.STUDENT && (
                            <div>
                                <label className="block text-xs font-medium">Class</label>
                                <input
                                    value={localClassId}
                                    onChange={e => setLocalClassId(e.target.value)}
                                    placeholder="e.g., Class 10-A or 9-B"
                                    className="mt-1 w-full rounded-md border-border dark:border-dark-border bg-card dark:bg-dark-card p-2 text-sm"
                                />
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button onClick={resetEdits} type="button" className="px-3 py-1.5 text-xs rounded-md border border-border dark:border-dark-border">Reset</button>
                            <button onClick={() => setEditMode(false)} type="button" className="px-3 py-1.5 text-xs rounded-md bg-primary text-white">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scaled card frame that reserves layout space */}
            <div className="relative inline-block" style={{ width: DISPLAY_W * (styleConfig.scale || 1), height: DISPLAY_H * (styleConfig.scale || 1) }}>
                <div className="absolute top-0 left-0" style={{ transform: `scale(${styleConfig.scale})`, transformOrigin: 'top left' }}>
                    <div id={`id-card-${user.id}`} data-pdf-size="card" className="relative bg-white rounded-lg shadow-lg border overflow-hidden transition-all" style={{ ...borderStyle, width: DISPLAY_W, height: DISPLAY_H }}>
                {/* Header with logo and university name + magenta line */}
                <div className="p-3 flex flex-col items-start gap-2">
                    {styleConfig.logoUrl ? (
                        <img crossOrigin="anonymous" src={styleConfig.logoUrl} alt="Logo" className="object-contain" style={{ height: styleConfig.logoHeight ?? 40 }} />
                    ) : (
                        <div className="h-10 flex items-center font-bold" style={{ color: styleConfig.primaryColor }}>{localSchoolName}</div>
                    )}
                    <div className="text-base font-semibold text-gray-900">{localSchoolName}</div>
                    <div className="h-1 w-full rounded" style={{ backgroundColor: '#e11787' }} />
                </div>
                {/* Body: centered photo with border and details */}
                <div className="px-3 pb-3">
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-5 flex items-start justify-center">
                            <div className="p-1 border" style={{ borderColor: styleConfig.photoBorderColor || styleConfig.primaryColor, borderWidth: (styleConfig.photoBorderWidth ?? 1) }}>
                                <img crossOrigin="anonymous" src={previewUser.profilePicture} alt={previewUser.name} className={`w-28 h-28 object-cover ${styleConfig.avatarShape === 'circle' ? 'rounded-full' : 'rounded'}`} />
                            </div>
                        </div>
                        <div className="col-span-7">
                            <div className="space-y-1 text-[13px]">
                                <div><span className="font-semibold">Name:</span> {previewUser.name}</div>
                                {className && (<div><span className="font-semibold">Class:</span> {className}</div>)}
                                <div><span className="font-semibold">Roll:</span> {cardId}</div>
                                <div><span className="font-semibold">Date of Birth:</span> {localDob || '—'}</div>
                                <div><span className="font-semibold">Year:</span> {localDobYear || (localDob ? localDob.slice(0,4) : '—')}</div>
                                {gender ? (<div><span className="font-semibold">Gender:</span> {gender}</div>) : null}
                                {bloodGroup ? (<div><span className="font-semibold">Blood Group:</span> {bloodGroup}</div>) : null}
                                {(fatherName || motherName) && (
                                    <div>
                                        <span className="font-semibold">Parents:</span> {fatherName || '—'}{(fatherName && motherName) ? ' & ' : ''}{motherName || (fatherName ? '' : '—')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* QR and Signature in same row */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center">
                            {styleConfig.showQr && (
                                <div className="flex flex-col items-start" data-export-exclude>
                                    <img crossOrigin="anonymous" src={qrUrl} alt="QR" style={{ width: qrDisplayPx, height: qrDisplayPx }} className="rounded-sm border border-gray-200" />
                                    <div className="mt-1 text-[10px] text-muted-foreground">
                                        <span>QR length: {qrData.length}</span>
                                        {qrData.length > 700 && <span className="ml-1 text-red-600">(long • increase size or shorten text)</span>}
                                    </div>
                                    <div className="mt-0.5 flex gap-2">
                                        <button type="button" onClick={() => navigator.clipboard?.writeText(qrData)} className="text-[10px] underline">Copy QR data</button>
                                        <details className="text-[10px]">
                                            <summary className="cursor-pointer select-none">View</summary>
                                            <pre className="max-w-[220px] whitespace-pre-wrap break-words p-1 bg-muted/50 rounded border border-border">{qrData}</pre>
                                        </details>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-center">
                            {styleConfig.signatureUrl ? (
                                <img crossOrigin="anonymous" src={styleConfig.signatureUrl} alt="Signature" className="h-10 object-contain" />
                            ) : (
                                <svg width="120" height="40" viewBox="0 0 120 40" className="text-gray-700"><path d="M5 30 C 20 10, 40 10, 55 28 S 90 40, 115 15" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                            )}
                            <div className="text-xs text-gray-700">{styleConfig.signatureLabel || 'Principal'}</div>
                        </div>
                    </div>
                </div>
                {/* Footer bar with Address and Mobile */}
                <div className="px-3 py-2 text-white text-[12px]" style={{ backgroundColor: styleConfig.primaryColor }}>
                    <div><span className="font-semibold">Address:</span> {styleConfig.footerAddress || '—'}</div>
                    <div><span className="font-semibold">Mobile:</span> {styleConfig.footerMobile || (previewUser as any).whatsapp || '—'}</div>
                </div>
            </div>
            </div>
            </div>

            {/* Controls below the card */}
            <div className="mt-2 flex justify-end" data-export-exclude>
                <button 
                    onClick={() => downloadElementAsPdf(`id-card-export-${user.id}`, `${previewUser.name}-ID.pdf`)}
                    className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90"
                    style={{ backgroundColor: styleConfig.primaryColor }}
                >
                    <FileDownIcon className="mr-1 h-4 w-4"/>
                    Download
                </button>
            </div>

            {/* Export-only template (hidden off-screen), sized as a card */}
            <div
                id={`id-card-export-${user.id}`}
                data-pdf-size="card"
                data-pdf-width-mm={`${styleConfig.cardWidthMm ?? 54}`}
                data-pdf-height-mm={`${styleConfig.cardHeightMm ?? 85.6}`}
                style={{ position: 'absolute', left: -10000, top: 0, width: 320, height: 480, background: '#fff', borderRadius: (styleConfig.borderRadius ?? 10) }}
                className="relative overflow-hidden border"
            >
                {/* Header with logo and school name */}
                <div className="p-3 flex flex-col items-start gap-2">
                    {styleConfig.logoUrl ? (
                        <img crossOrigin="anonymous" src={styleConfig.logoUrl} alt="Logo" className="object-contain" style={{ height: styleConfig.logoHeight ?? 40 }} />
                    ) : (
                        <div className="h-10 flex items-center font-bold" style={{ color: styleConfig.primaryColor }}>{localSchoolName}</div>
                    )}
                    <div className="text-base font-semibold text-gray-900">{localSchoolName}</div>
                    <div className="h-1 w-full rounded" style={{ backgroundColor: styleConfig.primaryColor }} />
                </div>
                {/* Body with photo and detailed fields (export) */}
                <div className="px-3 pb-3">
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-5 flex items-start justify-center">
                            <div className="p-1 border" style={{ borderColor: styleConfig.photoBorderColor || styleConfig.primaryColor, borderWidth: (styleConfig.photoBorderWidth ?? 1) }}>
                                <img crossOrigin="anonymous" src={previewUser.profilePicture} alt={previewUser.name} className={`w-28 h-28 object-cover ${styleConfig.avatarShape === 'circle' ? 'rounded-full' : 'rounded'}`} />
                            </div>
                        </div>
                        <div className="col-span-7">
                            <div className="space-y-1 text-[13px]">
                                <div><span className="font-semibold">Name:</span> {previewUser.name}</div>
                                {className && (<div><span className="font-semibold">Class:</span> {className}</div>)}
                                <div><span className="font-semibold">Roll:</span> {cardId}</div>
                                <div><span className="font-semibold">Date of Birth:</span> {localDob || '—'}</div>
                                <div><span className="font-semibold">Year:</span> {localDobYear || (localDob ? localDob.slice(0,4) : '—')}</div>
                                {gender ? (<div><span className="font-semibold">Gender:</span> {gender}</div>) : null}
                                {bloodGroup ? (<div><span className="font-semibold">Blood Group:</span> {bloodGroup}</div>) : null}
                                {(fatherName || motherName) && (
                                    <div>
                                        <span className="font-semibold">Parents:</span> {fatherName || '—'}{(fatherName && motherName) ? ' & ' : ''}{motherName || (fatherName ? '' : '—')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* QR and Signature row (export) */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center">
                            {styleConfig.showQr && (
                                <img crossOrigin="anonymous" src={qrUrl} alt="QR" style={{ width: qrDisplayPx, height: qrDisplayPx }} className="rounded-sm border border-gray-200" />
                            )}
                        </div>
                        <div className="flex flex-col items-center">
                            {styleConfig.signatureUrl ? (
                                <img crossOrigin="anonymous" src={styleConfig.signatureUrl} alt="Signature" className="h-10 object-contain" />
                            ) : (
                                <svg width="120" height="40" viewBox="0 0 120 40" className="text-gray-700"><path d="M5 30 C 20 10, 40 10, 55 28 S 90 40, 115 15" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                            )}
                            <div className="text-xs text-gray-700">{styleConfig.signatureLabel || 'Principal'}</div>
                        </div>
                    </div>
                </div>
                {/* Footer bar */}
                <div className="px-3 py-2 text-white text-[12px]" style={{ backgroundColor: styleConfig.primaryColor }}>
                    <div><span className="font-semibold">Address:</span> {styleConfig.footerAddress || '—'}</div>
                    <div><span className="font-semibold">Mobile:</span> {styleConfig.footerMobile || (previewUser as any).whatsapp || '—'}</div>
                </div>
            </div>

        </div>
    );
};

type DesignerProps = { styleConfig: CardStyle, setStyleConfig: React.Dispatch<React.SetStateAction<CardStyle>>, schoolName: string, exampleUser: AnyUser };
const DesignerCanvas: React.FC<DesignerProps> = ({ styleConfig, setStyleConfig, schoolName, exampleUser }) => {
    const [dragKey, setDragKey] = useState<keyof NonNullable<CardStyle['positions']> | null>(null);
    const [offset, setOffset] = useState<{x:number;y:number}>({ x: 0, y: 0 });

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragKey) return;
            const rect = (document.getElementById('designer-card-area') as HTMLDivElement)?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left - offset.x;
            const y = e.clientY - rect.top - offset.y;
            setStyleConfig(s => ({
                ...s,
                positions: { ...s.positions!, [dragKey]: { x: Math.max(0, Math.min(320 - 10, x)), y: Math.max(0, Math.min(200 - 10, y)) } }
            }));
        };
        const onUp = () => setDragKey(null);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [dragKey, offset, setStyleConfig]);

    const startDrag = (key: keyof NonNullable<CardStyle['positions']>) => (e: React.MouseEvent) => {
        const el = (e.target as HTMLElement);
        const rect = el.getBoundingClientRect();
        setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setDragKey(key);
    };

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-medium">Canvas (drag elements)</h4>
            <div id="designer-card-area" className="relative bg-white dark:bg-neutral-900 border border-border dark:border-dark-border rounded-md" style={{ width: 320, height: 200 }}>
                {/* Avatar */}
                <div
                    onMouseDown={startDrag('avatar')}
                    className="absolute cursor-move"
                    style={{ left: styleConfig.positions?.avatar.x ?? 16, top: styleConfig.positions?.avatar.y ?? 16 }}
                >
                    <img src={(exampleUser as AnyUser).profilePicture} className={`${styleConfig.avatarShape === 'circle' ? 'rounded-full' : 'rounded-lg'} w-24 h-24 object-cover border-2 border-primary`} />
                </div>
                {/* Name */}
                <div onMouseDown={startDrag('name')} className="absolute cursor-move select-none" style={{ left: styleConfig.positions?.name.x ?? 160, top: styleConfig.positions?.name.y ?? 20, zIndex: 10 }}>
                    <span className="font-semibold">{exampleUser.name}</span>
                </div>
                {/* ID */}
                <div onMouseDown={startDrag('id')} className="absolute cursor-move select-none text-xs text-muted-foreground" style={{ left: styleConfig.positions?.id.x ?? 160, top: styleConfig.positions?.id.y ?? 48, zIndex: 10 }}>
                    ID: SAMPLE1234
                </div>
                {/* Role */}
                <div onMouseDown={startDrag('role')} className="absolute cursor-move select-none text-[11px] px-2 py-0.5 rounded-full bg-accent" style={{ left: styleConfig.positions?.role.x ?? 160, top: styleConfig.positions?.role.y ?? 72, zIndex: 10 }}>
                    {exampleUser.role}
                </div>
                {/* Class */}
                <div onMouseDown={startDrag('class')} className="absolute cursor-move select-none text-xs" style={{ left: styleConfig.positions?.class.x ?? 160, top: styleConfig.positions?.class.y ?? 100, zIndex: 10 }}>
                    Class: 10-A
                </div>
                {/* QR */}
                {styleConfig.showQr && (
                    <div onMouseDown={startDrag('qr')} className="absolute cursor-move select-none" style={{ left: styleConfig.positions?.qr.x ?? 260, top: styleConfig.positions?.qr.y ?? 140, zIndex: 1 }}>
                        <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700" />
                    </div>
                )}
            </div>
        </div>
    );
};


const IDCard: React.FC<{ schoolName: string }> = ({ schoolName }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
    const [classFilter, setClassFilter] = useState<string>('All');
    const [designerOpen, setDesignerOpen] = useState(false);
    const [exportRole, setExportRole] = useState<Role | 'All'>('All');
    const [exportClass, setExportClass] = useState<string>('All');
    const [users, setUsers] = useState<AnyUser[]>([]);
    const [styleConfig, setStyleConfig] = useState<CardStyle>(() => {
        try {
            const saved = localStorage.getItem('idCardStyle');
            if (saved) return JSON.parse(saved);
        } catch {}
        return {
            primaryColor: '#2563EB',
            showQr: true,
            avatarShape: 'circle',
            layout: 'classic',
            scale: 1,
            bgImage: '',
            logoUrl: '',
            footerAddress: '',
            footerMobile: '',
            cardWidthMm: 60,
            cardHeightMm: 90,
            borderRadius: 10,
            logoHeight: 40,
            qrSizePx: 512,
            qrMode: 'text',
            qrExtraText: '',
            qrAutoSize: false,
            forcePlainText: true,
            compactText: true,
            minimalText: true,
            qrEcc: 'L',
            qrMargin: 8,
            photoBorderColor: '#2563EB',
            photoBorderWidth: 1,
            signatureUrl: '',
            signatureLabel: 'Principal',
            positions: {
                avatar: { x: 16, y: 16 },
                name: { x: 160, y: 20 },
                id: { x: 160, y: 48 },
                role: { x: 160, y: 72 },
                class: { x: 160, y: 100 },
                qr: { x: 260, y: 140 },
            }
        } as CardStyle;
    });

    useEffect(() => {
        try { localStorage.setItem('idCardStyle', JSON.stringify(styleConfig)); } catch {}
    }, [styleConfig]);
    // Preload PDF libs once to avoid first-use delay
    useEffect(() => { warmupPdfLibs().catch(() => {}); }, []);
    // Load users from Supabase
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await loadUsers();
                if (alive) setUsers(data);
            } catch (e) {
                console.error('Failed to load users for ID Cards', e);
            }
        })();
        return () => { alive = false; };
    }, []);
    
    // The roles for which ID cards can be generated
    const idCardRoles = [Role.ADMIN, Role.STAFF, Role.TEACHER, Role.STUDENT, Role.LIBRARIAN];

    // Build class list dynamically from students present in users
    const classOptions = useMemo(() => {
        const students = users.filter(u => u.role === Role.STUDENT) as StudentType[];
        const ids = Array.from(new Set(students.map(s => s.classId).filter(Boolean)));
        return ids.map(id => ({ id, name: id }));
    }, [users]);

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => idCardRoles.includes(user.role))
            .filter(user => roleFilter === 'All' || user.role === roleFilter)
            .filter(user => {
                if (roleFilter === Role.STUDENT && classFilter !== 'All') {
                    return (user as StudentType).classId === classFilter;
                }
                return true;
            })
            .filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [users, searchTerm, roleFilter, classFilter]);

    // Users for export filtering (separate from on-screen filters)
    const exportUsers = useMemo(() => {
        const exportAllowedRoles: Role[] = [Role.STUDENT, Role.STAFF, Role.LIBRARIAN];
        return users
            .filter(user => exportAllowedRoles.includes(user.role))
            .filter(user => exportRole === 'All' || user.role === exportRole)
            .filter(user => {
                if (exportRole === Role.STUDENT && exportClass !== 'All') {
                    return (user as StudentType).classId === exportClass;
                }
                return true;
            });
    }, [users, exportRole, exportClass]);

    // Compute responsive grid column width based on current card scale
    const itemWidthPx = Math.ceil(320 * (styleConfig.scale || 1));

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center sm:justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ID Card Management</h2>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex flex-wrap gap-2 items-center justify-end">
                    <button
                        type="button"
                        onClick={() => setDesignerOpen(true)}
                        className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-accent dark:hover:bg-dark-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                        Customize Cards
                    </button>
                    {/* Export filters at top-right */}
                    <select
                        value={exportRole}
                        onChange={e => { setExportRole(e.target.value as Role | 'All'); setExportClass('All'); }}
                        className="px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm"
                        title="Export Role"
                    >
                        <option value="All">All (Student, Staff, Librarian)</option>
                        <option value={Role.STUDENT}>Student</option>
                        <option value={Role.STAFF}>Staff</option>
                        <option value={Role.LIBRARIAN}>Librarian</option>
                    </select>
                    {exportRole === Role.STUDENT && (
                        <select
                            value={exportClass}
                            onChange={e => setExportClass(e.target.value)}
                            className="px-3 py-2 rounded-md border bg-card dark:bg-dark-card border-border dark:border-dark-border text-sm"
                            title="Export Class"
                        >
                            <option value="All">All Classes</option>
                            {classOptions.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => downloadElementAsPdf('idCardsGridExport', 'ID-Cards.pdf')}
                        className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-accent dark:hover:bg-dark-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        title="Export filtered cards to PDF"
                    >
                        <FileDownIcon className="-ml-1 mr-2 h-5 w-5" />
                        Export to PDF
                    </button>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-dark-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={e => {
                        setRoleFilter(e.target.value as Role | 'All');
                        setClassFilter('All'); // Reset class filter when role changes
                    }}
                    className="w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
                >
                    <option value="All">All Roles</option>
                    {idCardRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>

                {roleFilter === Role.STUDENT && (
                     <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border bg-card dark:bg-dark-card border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all duration-300"
                    >
                        <option value="All">All Classes</option>
                        {classOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}
            </div>
            
            <div
                id="idCardsGrid"
                className="grid gap-6"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${itemWidthPx}px, 1fr))` }}
            >
                {filteredUsers.map(user => (
                    <IdCardComponent key={user.id} user={user} schoolName={schoolName} styleConfig={styleConfig} />
                ))}
            </div>

            {/* (moved) export controls now placed in header */}

            {/* Hidden export container filtered by exportRole */}
            <div id="idCardsGridExport" data-export-fast="true" style={{ position: 'absolute', left: -10000, top: 0, background: '#fff' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {exportUsers.map(user => (
                        <IdCardComponent key={`export-${user.id}`} user={user} schoolName={schoolName} styleConfig={styleConfig} />
                    ))}
                </div>
            </div>

            {filteredUsers.length === 0 && (
                 <div className="col-span-full text-center py-16 text-muted-foreground dark:text-dark-muted-foreground bg-card dark:bg-dark-card rounded-lg border-2 border-dashed border-border dark:border-dark-border">
                    <h3 className="text-xl font-semibold">No ID Cards Found</h3>
                    <p>Try adjusting your search or filter criteria.</p>
                </div>
            )}

            {designerOpen && (
                <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
                    <div className="bg-card dark:bg-dark-card rounded-lg shadow-xl w-full max-w-6xl max-h-full overflow-y-auto border border-border dark:border-dark-border">
                        <div className="p-4 flex items-center justify-between border-b border-border dark:border-dark-border">
                            <h3 className="text-lg font-semibold">Card Designer</h3>
                            <button onClick={() => setDesignerOpen(false)} className="px-3 py-1.5 text-sm rounded-md border border-border dark:border-dark-border">Close</button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium">Primary Color</label>
                                    <input type="color" value={styleConfig.primaryColor} onChange={e => setStyleConfig(s => ({ ...s, primaryColor: e.target.value }))} className="mt-1 h-10 w-20 p-0 bg-transparent border-0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Show QR</label>
                                    <input type="checkbox" checked={styleConfig.showQr} onChange={e => setStyleConfig(s => ({ ...s, showQr: e.target.checked }))} className="mt-1" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">QR Content</label>
                                    <select value={styleConfig.qrMode ?? 'embedded'} onChange={e => setStyleConfig(s => ({ ...s, qrMode: e.target.value as 'embedded' | 'text' | 'url' }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2">
                                        <option value="embedded">Embedded details (vCard, offline)</option>
                                        <option value="text">Embedded plain text (offline)</option>
                                        <option value="url">Open profile page (online)</option>
                                    </select>
                                    <p className="mt-1 text-xs text-muted-foreground">Embedded shows full info in scanner and works offline.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">QR Size (px)</label>
                                    <input type="number" min="64" max="512" step="4" value={styleConfig.qrSizePx ?? 120} onChange={e => setStyleConfig(s => ({ ...s, qrSizePx: Math.max(64, Math.min(512, parseInt(e.target.value || '120', 10))) }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input id="qrAutoSize" type="checkbox" checked={!!styleConfig.qrAutoSize} onChange={e => setStyleConfig(s => ({ ...s, qrAutoSize: e.target.checked }))} />
                                    <label htmlFor="qrAutoSize" className="text-sm font-medium">Auto-size QR by content</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input id="forcePlainText" type="checkbox" checked={!!styleConfig.forcePlainText} onChange={e => setStyleConfig(s => ({ ...s, forcePlainText: e.target.checked }))} />
                                    <label htmlFor="forcePlainText" className="text-sm font-medium">Force plain text for all cards</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input id="minimalText" type="checkbox" checked={!!styleConfig.minimalText} onChange={e => setStyleConfig(s => ({ ...s, minimalText: e.target.checked }))} />
                                    <label htmlFor="minimalText" className="text-sm font-medium">Minimal text (largest dots)</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input id="compactText" type="checkbox" checked={!!styleConfig.compactText} onChange={e => setStyleConfig(s => ({ ...s, compactText: e.target.checked }))} />
                                    <label htmlFor="compactText" className="text-sm font-medium">Compact text (short labels)</label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">QR Error Correction</label>
                                    <select value={styleConfig.qrEcc || 'L'} onChange={e => setStyleConfig(s => ({ ...s, qrEcc: e.target.value as 'L'|'M'|'Q'|'H' }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2">
                                        <option value="L">L (least redundancy, bigger modules)</option>
                                        <option value="M">M</option>
                                        <option value="Q">Q</option>
                                        <option value="H">H (most redundancy)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">QR Margin (quiet zone)</label>
                                    <input type="number" min="0" max="20" step="1" value={styleConfig.qrMargin ?? 8} onChange={e => setStyleConfig(s => ({ ...s, qrMargin: Math.max(0, Math.min(20, parseInt(e.target.value || '8', 10))) }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">QR Extra Text (optional)</label>
                                    <textarea value={styleConfig.qrExtraText ?? ''} onChange={e => setStyleConfig(s => ({ ...s, qrExtraText: e.target.value }))} rows={3} placeholder="e.g., Address, Guardian, Blood Group, Emergency Contact" className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    <p className="mt-1 text-xs text-muted-foreground">Added to QR content only (not printed). Keep it concise for better scan quality.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Avatar Shape</label>
                                    <select value={styleConfig.avatarShape} onChange={e => setStyleConfig(s => ({ ...s, avatarShape: e.target.value as 'circle' | 'rounded' }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2">
                                        <option value="circle">Circle</option>
                                        <option value="rounded">Rounded</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Layout</label>
                                    <select value={styleConfig.layout} onChange={e => setStyleConfig(s => ({ ...s, layout: e.target.value as CardLayout }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2">
                                        <option value="classic">Classic (vertical)</option>
                                        <option value="side">Side (avatar left)</option>
                                        <option value="freeform">Freeform (drag & drop)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Scale ({styleConfig.scale.toFixed(2)})</label>
                                    <input type="range" min="0.8" max="1.4" step="0.01" value={styleConfig.scale} onChange={e => setStyleConfig(s => ({ ...s, scale: parseFloat(e.target.value) }))} className="mt-1 w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Background Image URL</label>
                                    <input type="text" value={styleConfig.bgImage} onChange={e => setStyleConfig(s => ({ ...s, bgImage: e.target.value }))} placeholder="https://..." className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    <p className="mt-1 text-xs text-muted-foreground dark:text-dark-muted-foreground">Applies to the card body area.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium">Card Width (cm)</label>
                                        <input type="number" min="3" max="15" step="0.1" value={(styleConfig.cardWidthMm ?? 54) / 10} onChange={e => {
                                            const cm = parseFloat(e.target.value);
                                            setStyleConfig(s => ({ ...s, cardWidthMm: (isNaN(cm) ? 5.4 : cm) * 10 }));
                                        }} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Card Height (cm)</label>
                                        <input type="number" min="3" max="15" step="0.1" value={(styleConfig.cardHeightMm ?? 85.6) / 10} onChange={e => {
                                            const cm = parseFloat(e.target.value);
                                            setStyleConfig(s => ({ ...s, cardHeightMm: (isNaN(cm) ? 8.56 : cm) * 10 }));
                                        }} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2">
                                        <button type="button" onClick={() => setStyleConfig(s => ({ ...s, cardWidthMm: s.cardHeightMm ?? 85.6, cardHeightMm: s.cardWidthMm ?? 54 }))} className="px-3 py-1.5 text-sm rounded-md border border-border dark:border-dark-border">Swap Orientation</button>
                                        <div className="text-xs text-muted-foreground">Portrait if height &gt; width</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium">Border Radius (px)</label>
                                        <input type="number" min="0" max="24" value={styleConfig.borderRadius ?? 10} onChange={e => setStyleConfig(s => ({ ...s, borderRadius: parseInt(e.target.value || '0', 10) }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Logo Height (px)</label>
                                        <input type="number" min="16" max="80" value={styleConfig.logoHeight ?? 40} onChange={e => setStyleConfig(s => ({ ...s, logoHeight: parseInt(e.target.value || '40', 10) }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium">Photo Border Color</label>
                                        <input type="color" value={styleConfig.photoBorderColor || '#2563EB'} onChange={e => setStyleConfig(s => ({ ...s, photoBorderColor: e.target.value }))} className="mt-1 h-10 w-16 p-0 bg-transparent border-0" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Photo Border Width (px)</label>
                                        <input type="number" min="0" max="6" value={styleConfig.photoBorderWidth ?? 1} onChange={e => setStyleConfig(s => ({ ...s, photoBorderWidth: parseInt(e.target.value || '0', 10) }))} className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Logo URL (export)</label>
                                    <input type="text" value={styleConfig.logoUrl || ''} onChange={e => setStyleConfig(s => ({ ...s, logoUrl: e.target.value }))} placeholder="https://..." className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Footer Address (export)</label>
                                    <input type="text" value={styleConfig.footerAddress || ''} onChange={e => setStyleConfig(s => ({ ...s, footerAddress: e.target.value }))} placeholder="2330 Lakeland Park Dr, Atlanta, GA" className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Footer Mobile (export)</label>
                                    <input type="text" value={styleConfig.footerMobile || ''} onChange={e => setStyleConfig(s => ({ ...s, footerMobile: e.target.value }))} placeholder="+1234567890" className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Signature Label</label>
                                    <input type="text" value={styleConfig.signatureLabel || ''} onChange={e => setStyleConfig(s => ({ ...s, signatureLabel: e.target.value }))} placeholder="Principal" className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Signature URL</label>
                                    <input type="text" value={styleConfig.signatureUrl || ''} onChange={e => setStyleConfig(s => ({ ...s, signatureUrl: e.target.value }))} placeholder="https://... or data:image/png;base64,..." className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Upload Digital Signature</label>
                                    <input type="file" accept="image/*" onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => setStyleConfig(s => ({ ...s, signatureUrl: String(reader.result || '') }));
                                        reader.readAsDataURL(file);
                                    }} className="mt-1 block w-full text-xs" />
                                    <p className="mt-1 text-xs text-muted-foreground">PNG with transparent background looks best.</p>
                                </div>
                            </div>
                            <DesignerCanvas styleConfig={styleConfig} setStyleConfig={setStyleConfig} schoolName={schoolName} exampleUser={(users.find(u => u.role === Role.STUDENT) || users[0]) as AnyUser} />
                        </div>
                        <div className="p-4 border-t border-border dark:border-dark-border flex justify-end gap-2">
                            <button onClick={() => { try { localStorage.removeItem('idCardStyle'); } catch {}; setStyleConfig({ primaryColor: '#2563EB', showQr: true, avatarShape: 'circle', layout: 'classic', scale: 1, bgImage: '', logoUrl: '', footerAddress: '', footerMobile: '', cardWidthMm: 54, cardHeightMm: 85.6, borderRadius: 10, logoHeight: 40, qrSizePx: 512, qrMode: 'text', qrExtraText: '', qrAutoSize: false, forcePlainText: true, minimalText: true, compactText: true, qrEcc: 'L', qrMargin: 8, photoBorderColor: '#2563EB', photoBorderWidth: 1, signatureUrl: '', signatureLabel: 'Principal', positions: { avatar: { x: 16, y: 16 }, name: { x: 160, y: 20 }, id: { x: 160, y: 48 }, role: { x: 160, y: 72 }, class: { x: 160, y: 100 }, qr: { x: 260, y: 140 } } }); }} className="px-3 py-1.5 text-sm rounded-md border border-border dark:border-dark-border">Reset Defaults</button>
                            <button onClick={() => setDesignerOpen(false)} className="px-3 py-1.5 text-sm rounded-md bg-primary text-white" style={{ backgroundColor: styleConfig.primaryColor }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default IDCard;