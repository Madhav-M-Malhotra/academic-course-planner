// ============================================================
// GER Enum → Human-readable label map  (matches schema.prisma)
// ============================================================
const GER_LABELS = {
    HL:  'Humanities and Languages',
    SS:  'Social Sciences',
    MPL: 'Mathematical and Physical Sciences',
    BLS: 'Biological and Life Sciences',
    PVA: 'Performing and Visual Arts'
};

// Day abbreviation used inside timings string (for timetable grid)
const DAY_SHORT = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
};

class CourseManager {
    constructor() {
        this.courses     = [];   // formatted course objects
        this.rawPlanned  = [];   // raw plannedCourses from backend { course_code, section_no }
        this.selectedCart = [];  // { course, section } pairs shown in timetable
        this.schoolPages  = {};
        this.COURSES_PER_PAGE = 10;
        this.filteredCourses  = []; // subset of courses matching current filters
        this.init();
    }

    // ----------------------------------------------------------
    // INIT
    // ----------------------------------------------------------
    async init() {
        await this.fetchCoursesFromBackend();
        this.populateFilters();
        this.applyFilters(); // Initial render via filtering
        this.setupFilters();
    }

    // ----------------------------------------------------------
    // 1. FETCH & FORMAT DATA FROM BACKEND
    // ----------------------------------------------------------
    async fetchCoursesFromBackend() {
        try {
            const response = await fetch('/courses');
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

            const data = await response.json();
            // Backend returns { plannedCourses, coursesList }
            const rawCoursesList = data.coursesList  || [];
            this.rawPlanned      = data.plannedCourses || [];

            this.courses = this.formatBackendCourses(rawCoursesList, this.rawPlanned);
            this.filteredCourses = [...this.courses]; // Default to all courses

            // Hydrate cart from planned courses
            this.rawPlanned.forEach(planned => {
                const course = this.courses.find(c => c.id === planned.course_code);
                if (!course) return;
                const section = course.sections.find(
                    s => String(s.sectionNo) === String(planned.section_no)
                );
                if (course && section) {
                    this.selectedCart.push({ course, section });
                }
            });

            console.log(`Loaded ${this.courses.length} courses. Cart hydrated with ${this.selectedCart.length} planned course(s).`);

        } catch (error) {
            console.error('Failed to fetch courses from backend:', error);
            const container = document.getElementById('courseDirectoryContainer');
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger" role="alert">
                        <strong>Could not load courses.</strong> Make sure the database is connected and seeded.
                        <br><small class="text-muted">Error: ${error.message}</small>
                    </div>
                </div>`;
            this.courses = [];
        }
    }

    // ----------------------------------------------------------
    // 2. SHAPE PRISMA RAW DATA → FRONTEND SCHEMA
    // ----------------------------------------------------------
    formatBackendCourses(rawList, plannedCourses) {
        // Build a fast lookup: course_code → compatible_section_nos[]
        // NOTE: plannedCourses here is the Section[] with .schedule,
        // not the compatibility list. Compatible info is embedded directly
        // on each section via course.sections[i].compatible (set by updateCompatibility).
        return rawList.map(course => {
            const facultyNames = (course.faculties || []).map(f => f.name);

            const sections = (course.sections || []).map(sec => {
                // Format timings: "Monday [08:00 to 09:30] | Wednesday [08:00 to 09:30]"
                const timings = (sec.schedule || []).map(sch => {
                    const startStr = this._formatTime(sch.start_time);
                    const endStr   = this._formatTime(sch.end_time);
                    return `${sch.day} [${startStr} to ${endStr}]`;
                }).join(' | ');

                return {
                    id:        `${course.code}_${sec.section_no}`,  // unique composite key
                    sectionNo: sec.section_no,
                    name:      `Section ${sec.section_no}`,
                    faculty:   facultyNames.join(', ') || 'TBA',
                    timings:   timings || 'No schedule',
                    disabled:  (sec.compatible === false),           // set by backend updateCompatibility
                    schedule:  sec.schedule || []                    // raw schedule for filter logic
                };
            });

            return {
                id:            course.code,
                code:          course.code,
                name:          course.name,
                credits:       course.credits,
                school:        course.school,
                description:   course.description || '',
                gerOptions:    GER_LABELS[course.ger] || 'Not Applicable',
                gerRaw:        course.ger || null,
                prerequisite:  course.prereqs    || 'None',
                antirequisite: course.antireqs   || 'None',
                term:          course.term       || '',
                compatible:    course.compatible !== false,  // from updateCompatibility
                sections
            };
        });
    }

    // Parse Prisma DateTime ISO string → "HH:MM"
    _formatTime(dateTimeStr) {
        if (!dateTimeStr) return '??:??';
        const d = new Date(dateTimeStr);
        // Prisma @db.Time stores as 1970-01-01THH:MM:SS.000Z
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // ----------------------------------------------------------
    // 3. POPULATE FILTER DROPDOWNS FROM REAL DATA
    // ----------------------------------------------------------
    populateFilters() {
        if (!this.courses.length) return;

        // Credits
        const credits = [...new Set(this.courses.map(c => String(c.credits)))].sort((a,b) => parseFloat(a) - parseFloat(b));
        const creditsSelect = document.getElementById('filterCredits');
        creditsSelect.innerHTML = '<option value="All">All Credits</option>';
        credits.forEach(cr => { creditsSelect.innerHTML += `<option value="${cr}">${cr}</option>`; });

        // GER
        const gers = [...new Set(this.courses.map(c => c.gerOptions))].filter(Boolean).sort();
        const gerSelect = document.getElementById('filterGer');
        gerSelect.innerHTML = '<option value="All">All Categories</option>';
        gers.forEach(g => { gerSelect.innerHTML += `<option value="${g}">${g}</option>`; });

        // Faculty
        const facultySet = new Set();
        this.courses.forEach(c => {
            c.sections.forEach(sec => {
                if (sec.faculty && sec.faculty !== 'TBA') {
                    sec.faculty.split(',').forEach(f => {
                        const t = f.trim();
                        if (t) facultySet.add(t);
                    });
                }
            });
        });
        const faculties = [...facultySet].sort();
        const facultySelect = document.getElementById('filterFaculty');
        facultySelect.innerHTML = '<option value="All">All Faculty</option>';
        faculties.forEach(f => { facultySelect.innerHTML += `<option value="${f}">${f}</option>`; });
    }

    // ----------------------------------------------------------
    // 4. RENDER COURSES (grouped by school, paginated)
    // ----------------------------------------------------------
    renderCourses() {
        const container = document.getElementById('courseDirectoryContainer');
        container.innerHTML = '';
        if (!this.filteredCourses.length) {
            container.innerHTML = '<div class="col-12 text-center text-muted p-5">No courses match your criteria.</div>';
            return;
        }

        const schools = [...new Set(this.filteredCourses.map(c => c.school))].sort();

        schools.forEach(schoolName => {
            const allSchoolCourses = this.filteredCourses.filter(c => c.school === schoolName);
            if (!(schoolName in this.schoolPages)) this.schoolPages[schoolName] = 1;

            const totalPages  = Math.ceil(allSchoolCourses.length / this.COURSES_PER_PAGE);
            // Ensure current page is within bounds (e.g. after filtering reduces results)
            if (this.schoolPages[schoolName] > totalPages) this.schoolPages[schoolName] = totalPages || 1;
            
            const currentPage = this.schoolPages[schoolName];
            const startIdx    = (currentPage - 1) * this.COURSES_PER_PAGE;
            const pageCourses = allSchoolCourses.slice(startIdx, startIdx + this.COURSES_PER_PAGE);

            const col = document.createElement('div');
            col.className = 'col school-col-wrapper';
            col.setAttribute('data-school', schoolName);

            let tableRows = '';
            pageCourses.forEach(course => {
                const isPlanned   = this.selectedCart.some(item => item.course.id === course.id);
                const trClass     = (course.compatible !== false) ? 'course-row' : 'course-row course-incompatible';
                const courseFaculty = course.sections.map(s => s.faculty).join(', ');

                // Sections radio form
                let sectionsHtml = '';
                if (course.sections.length > 0) {
                    sectionsHtml = `<form id="form-course-${course.id}" class="mb-3">`;
                    course.sections.forEach(sec => {
                        const disabled   = sec.disabled || isPlanned;
                        const labelClass = disabled ? 'section-info text-muted' : 'section-info';
                        sectionsHtml += `
                            <label class="section-choice">
                                <input type="radio" name="sectionOption" value="${sec.sectionNo}" ${disabled ? 'disabled' : ''}>
                                <div class="${labelClass}">
                                    <strong>${sec.name}</strong>
                                    ${sec.disabled ? '<span class="badge bg-danger ms-2">Time Conflict</span>' : ''}
                                    ${isPlanned    ? '<span class="badge bg-success ms-2">Added</span>' : ''}
                                    <br>
                                    <small class="text-muted">Faculty: ${sec.faculty}</small><br>
                                    <small>${sec.timings}</small>
                                </div>
                            </label>`;
                    });
                    sectionsHtml += `</form>`;
                } else {
                    sectionsHtml = `<p class="text-muted">No sections available.</p>`;
                }

                const addBtnDisabled = isPlanned ? 'disabled' : '';
                const addBtnText     = isPlanned ? 'Already Added' : 'Add Course';

                tableRows += `
                    <tr class="${trClass}"
                        data-course-id="${course.id}"
                        data-ger="${course.gerOptions}"
                        data-credits="${course.credits}"
                        data-name="${course.name.toLowerCase()}"
                        data-code="${course.code.toLowerCase()}"
                        data-faculty="${courseFaculty.toLowerCase()}">
                        <td class="d-flex align-items-center flex-nowrap">
                            <button class="btn-plus flex-shrink-0" onclick="courseManager.toggleDetails('${course.id}')">+</button>
                            <span class="text-truncate">${course.code}</span>
                        </td>
                        <td>${course.name}</td>
                        <td>${course.credits}</td>
                    </tr>
                    <tr id="details-${course.id}" class="details-row">
                        <td colspan="3">
                            <div class="details-content">
                                <h6>Prerequisite Course Code</h6>
                                <p>${course.prerequisite}</p>
                                <h6>Antirequisite Course Code</h6>
                                <p>${course.antirequisite}</p>
                                <h6>Course Description</h6>
                                <p>${course.description || 'No description available.'}</p>
                                <h6>GER Category</h6>
                                <p>${course.gerOptions}</p>
                                <h6>Schedule Selection</h6>
                                ${sectionsHtml}
                                <button class="btn-add mt-2" onclick="courseManager.addCourse('${course.id}')"
                                    id="add-btn-${course.id}" ${addBtnDisabled}>
                                    ${addBtnText}
                                </button>
                                <span class="text-danger small ms-2" id="error-msg-${course.id}" style="display:none;"></span>
                            </div>
                        </td>
                    </tr>`;
            });

            // Pagination buttons
            let paginationHtml = '';
            if (totalPages > 1) {
                paginationHtml = '<div class="d-flex justify-content-center align-items-center gap-1 mt-3 mb-2">';
                for (let p = 1; p <= totalPages; p++) {
                    const activeClass = (p === currentPage) ? 'btn-dark' : 'btn-outline-secondary';
                    paginationHtml += `<button class="btn ${activeClass} btn-sm px-2 py-1" style="min-width:30px;font-size:0.75rem;"
                        onclick="courseManager.goToPage('${schoolName}', ${p})">${p}</button>`;
                }
                paginationHtml += '</div>';
            }

            const countInfo = `<div class="text-muted text-center" style="font-size:0.75rem;">
                Showing ${startIdx+1}–${Math.min(startIdx + this.COURSES_PER_PAGE, allSchoolCourses.length)} of ${allSchoolCourses.length} courses
            </div>`;

            col.innerHTML = `
                <div class="school-card shadow-sm h-100">
                    <div class="school-header">${schoolName}</div>
                    <div class="p-3">
                        <table class="course-table">
                            <thead>
                                <tr>
                                    <th style="width:25%;">Course Code</th>
                                    <th>Course Name</th>
                                    <th style="width:15%;">Credits</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                        ${countInfo}
                        ${paginationHtml}
                    </div>
                </div>`;
            container.appendChild(col);
        });

        // After rendering, render timetable (cart might be hydrated from init)
        this.renderTimetable();
    }

    goToPage(schoolName, page) {
        this.schoolPages[schoolName] = page;
        this.renderCourses();
    }

    toggleDetails(courseId) {
        const row = document.getElementById(`details-${courseId}`);
        if (row) {
            row.style.display = (row.style.display === 'table-row') ? 'none' : 'table-row';
        }
    }

    // ----------------------------------------------------------
    // 5. ADD COURSE → POST /plan/:courseCode
    // ----------------------------------------------------------
    async addCourse(courseId) {
        const form        = document.getElementById(`form-course-${courseId}`);
        const selectedRadio = form ? form.querySelector('input[name="sectionOption"]:checked') : null;

        if (!selectedRadio) {
            alert('Please select a specific section before adding the course.');
            return;
        }

        const sectionNo = parseInt(selectedRadio.value, 10);
        const course    = this.courses.find(c => c.id === courseId);
        const section   = course.sections.find(s => s.sectionNo === sectionNo);

        if (this.selectedCart.some(item => item.course.id === courseId)) {
            alert(`${course.code} is already in your plan.`);
            return;
        }

        try {
            const response = await fetch(`/plan/${encodeURIComponent(courseId)}`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ section_no: sectionNo })
            });

            if (response.status === 201) {
                // Successfully added — response is the new compatibility list
                const compatibilityList = await response.json();
                // compatibilityList is: [{ course_code, sections: [compatible_section_nos] }]

                // Add to local cart
                this.selectedCart.push({ course, section });

                // Close details row
                this.toggleDetails(courseId);

                // Update which courses/sections are now incompatible
                this.applyCompatibilityUpdate(compatibilityList);

                // Re-render timetable
                this.renderTimetable();

            } else {
                // 409 TIME_CONFLICT, 400 COURSE_NOT_FOUND, etc.
                const errorData = await response.json();
                const errMsg    = errorData.error || 'Could not add course.';
                this.showClashPopup(errMsg);
                this.markCourseIncompatible(courseId, errMsg);
            }
        } catch (err) {
            console.error('Add course failed:', err);
            alert('Network error. Could not add course.');
        }
    }

    // Apply the compatibility list returned from POST /plan
    // Format: [{ course_code, sections: [section_nos_that_are_compatible] }]
    applyCompatibilityUpdate(compatibilityList) {
        // Build a fast lookup set of compatible {courseCode_sectionNo}
        const compatibleSet = new Set();
        compatibilityList.forEach(entry => {
            entry.sections.forEach(sNo => {
                compatibleSet.add(`${entry.course_code}_${sNo}`);
            });
        });

        // Build set of course codes that appear in compatibility list at all
        const compatibleCourseCodes = new Set(compatibilityList.map(e => e.course_code));

        // Update each course's compatibility state
        this.courses.forEach(course => {
            if (compatibleCourseCodes.has(course.id)) {
                course.compatible = true;
                course.sections.forEach(sec => {
                    sec.disabled = !compatibleSet.has(`${course.id}_${sec.sectionNo}`);
                });
            } else {
                // Course does not appear in compatible list → fully incompatible
                course.compatible = false;
                course.sections.forEach(sec => { sec.disabled = true; });
            }
        });

        // Re-render to reflect new states
        this.renderCourses();
    }

    // ----------------------------------------------------------
    // 6. REMOVE COURSE → DELETE /plan/:courseCode
    // ----------------------------------------------------------
    async removeCourse(courseId) {
        try {
            const response = await fetch(`/plan/${encodeURIComponent(courseId)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Successfully removed from DB
                const compatibilityList = await response.json();

                // Remove from local cart
                this.selectedCart = this.selectedCart.filter(item => item.course.id !== courseId);

                // Re-apply updated compatibility
                this.applyCompatibilityUpdate(compatibilityList);
                this.renderTimetable();
            } else {
                const errorData = await response.json();
                console.error('Remove failed:', errorData.error);
                alert(`Could not remove course: ${errorData.error}`);
            }
        } catch (err) {
            console.error('Remove course failed:', err);
            // Optimistically remove from cart on network failure
            this.selectedCart = this.selectedCart.filter(item => item.course.id !== courseId);
            this.renderTimetable();
        }
    }

    // ----------------------------------------------------------
    // 7. UI HELPERS
    // ----------------------------------------------------------
    showClashPopup(message) {
        const modalBody = document.getElementById('clashModalBody');
        modalBody.innerText = message;
        const clashModal = new bootstrap.Modal(document.getElementById('clashModal'));
        clashModal.show();
    }

    markCourseIncompatible(courseId, conflictMsg) {
        const row = document.querySelector(`.course-row[data-course-id="${courseId}"]`);
        if (row) row.classList.add('course-incompatible');

        const btn = document.getElementById(`add-btn-${courseId}`);
        if (btn) { btn.classList.add('disabled'); btn.setAttribute('disabled', 'true'); }

        const errorMsg = document.getElementById(`error-msg-${courseId}`);
        if (errorMsg) { errorMsg.innerText = conflictMsg; errorMsg.style.display = 'inline'; }
    }

    markCourseCompatible(courseId) {
        const row = document.querySelector(`.course-row[data-course-id="${courseId}"]`);
        if (row) row.classList.remove('course-incompatible');

        const btn = document.getElementById(`add-btn-${courseId}`);
        if (btn) { btn.classList.remove('disabled'); btn.removeAttribute('disabled'); }

        const errorMsg = document.getElementById(`error-msg-${courseId}`);
        if (errorMsg) { errorMsg.style.display = 'none'; errorMsg.innerText = ''; }
    }

    // ----------------------------------------------------------
    // 8. TIMETABLE RENDERER
    // ----------------------------------------------------------
    renderTimetable() {
        const container = document.getElementById('timetableContainer');
        container.innerHTML = '';

        if (!this.selectedCart.length) {
            container.innerHTML = '<p class="text-muted small">No courses added yet.</p>';
            return;
        }

        const weekDays      = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weekDaysShort = ['Mon',    'Tue',    'Wed',       'Thu',      'Fri',    'Sat',      'Sun'];
        const startHour     = 8;
        const totalHalfHours = 24; // 8:00–20:00

        // Header
        let headerHtml = `<div class="timetable-header-grid"><div></div>`;
        weekDaysShort.forEach(d => { headerHtml += `<div>${d}</div>`; });
        headerHtml += `</div>`;

        // Body grid (background cells)
        let bodyHtml = `<div class="timetable-body-grid">`;
        for (let i = 0; i < totalHalfHours; i++) {
            if (i % 2 === 0) {
                const hourStr = String(startHour + i/2).padStart(2,'0') + ':00';
                bodyHtml += `<div class="grid-cell time-label" style="grid-row:${i+1};grid-column:1;"><span>${hourStr}</span></div>`;
            } else {
                bodyHtml += `<div class="grid-cell time-label" style="grid-row:${i+1};grid-column:1;"></div>`;
            }
            for (let j = 0; j < 7; j++) {
                bodyHtml += `<div class="grid-cell" style="grid-row:${i+1};grid-column:${j+2};"></div>`;
            }
        }

        // Course blocks
        const colors = ['#fce4ec','#fff9c4','#e8f5e9','#fff3e0','#e3f2fd','#f3e5f5'];
        this.selectedCart.forEach((item, index) => {
            const color = colors[index % colors.length];
            const code  = item.course.code;
            const sec   = item.section;

            // Parse timings string: "Monday [08:00 to 09:30] | Wednesday [08:00 to 09:30]"
            const parts = (sec.timings || '').split('|').map(p => p.trim());
            parts.forEach(part => {
                // Match both full names (Monday) and short (Mon)
                const match = part.match(/(\w+) \[(\d{2}):(\d{2}) to (\d{2}):(\d{2})\]/);
                if (!match) return;

                const dayFull  = match[1]; // e.g. "Monday"
                const dayIndex = weekDays.indexOf(dayFull);
                if (dayIndex === -1) return;

                const sH = parseInt(match[2]);
                const sM = parseInt(match[3]);
                const eH = parseInt(match[4]);
                const eM = parseInt(match[5]);

                const startRow = ((sH - startHour) * 2) + (sM / 30) + 1;
                const endRow   = ((eH - startHour) * 2) + (eM / 30) + 1;
                const rowSpan  = endRow - startRow;
                const col      = dayIndex + 2;

                bodyHtml += `
                    <div class="course-block" style="grid-row:${startRow}/span ${rowSpan};grid-column:${col};background-color:${color};">
                        <button class="remove-btn" onclick="courseManager.removeCourse('${item.course.id}')">&times;</button>
                        <strong>${code} - ${sec.name.replace('Section ','S')}</strong>
                        <span>${String(sH).padStart(2,'0')}:${String(sM).padStart(2,'0')} - ${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}</span>
                    </div>`;
            });
        });
        bodyHtml += `</div>`;
        container.innerHTML = `<div class="timetable-wrapper">${headerHtml}${bodyHtml}</div>`;
    }

    // ----------------------------------------------------------
    // 9. FILTER LOGIC
    // ----------------------------------------------------------
    setupFilters() {
        document.getElementById('filterForm').addEventListener('change', () => this.applyFilters(true));
        document.getElementById('searchQuery').addEventListener('input', () => this.applyFilters(true));

        const dlBtn = document.getElementById('downloadTimetableBtn');
        if (dlBtn) dlBtn.addEventListener('click', () => this.downloadTimetable());

        const uploadForm = document.getElementById('uploadTranscriptForm');
        if (uploadForm) uploadForm.addEventListener('submit', e => this.uploadTranscript(e));
    }

    /**
     * Filters the full this.courses array based on user selection
     * and updates this.filteredCourses.
     * @param {boolean} resetPages - If true, resets current page to 1 for all schools.
     */
    applyFilters(resetPages = false) {
        const dayVal     = document.getElementById('filterDay').value;       // 'All' or 'Monday' etc.
        const timeVal    = document.getElementById('filterTimeSlot').value;  // 'All' or 'HH:00'
        const creditsVal = document.getElementById('filterCredits').value;
        const gerVal     = document.getElementById('filterGer').value;
        const facultyVal = document.getElementById('filterFaculty').value;
        const searchVal  = document.getElementById('searchQuery').value.toLowerCase().trim();

        if (resetPages) {
            Object.keys(this.schoolPages).forEach(school => {
                this.schoolPages[school] = 1;
            });
        }

        this.filteredCourses = this.courses.filter(course => {
            let isMatch = true;

            // Credits check
            if (creditsVal !== 'All' && String(course.credits) !== creditsVal) {
                isMatch = false;
            }

            // GER check
            if (isMatch && gerVal !== 'All' && course.gerOptions !== gerVal) {
                isMatch = false;
            }

            // Faculty check
            if (isMatch && facultyVal !== 'All') {
                const facMatch = course.sections.some(sec => 
                    sec.faculty.toLowerCase().includes(facultyVal.toLowerCase())
                );
                if (!facMatch) isMatch = false;
            }

            // Search query (Code or Name)
            if (isMatch && searchVal) {
                const nameLower = course.name.toLowerCase();
                const codeLower = course.code.toLowerCase();
                if (!nameLower.includes(searchVal) && !codeLower.includes(searchVal)) {
                    isMatch = false;
                }
            }

            // Time/Day filter (checks all sections of the course)
            if (isMatch && (dayVal !== 'All' || timeVal !== 'All')) {
                let hasMatchingSection = false;
                for (const sec of course.sections) {
                    let secMatch = true;

                    if (dayVal !== 'All') {
                        const hasDay = (sec.schedule || []).some(sch => sch.day === dayVal);
                        if (!hasDay) secMatch = false;
                    }

                    if (secMatch && timeVal !== 'All') {
                        const slotStartMin = parseInt(timeVal.split(':')[0]) * 60;
                        const slotEndMin   = slotStartMin + 60;
                        const hasTime = (sec.schedule || []).some(sch => {
                            const t = new Date(sch.start_time);
                            const startMin = t.getUTCHours() * 60 + t.getUTCMinutes();
                            return startMin >= slotStartMin && startMin < slotEndMin;
                        });
                        if (!hasTime) secMatch = false;
                    }

                    if (secMatch) {
                        hasMatchingSection = true;
                        break;
                    }
                }
                if (!hasMatchingSection) isMatch = false;
            }

            return isMatch;
        });

        // Re-render table with filtered results
        this.renderCourses();
    }

    // ----------------------------------------------------------
    // 10. TRANSCRIPT UPLOAD → POST /api/upload-transcript
    //     (Backend adds a single new multer route in acp.routes.js)
    // ----------------------------------------------------------
    async uploadTranscript(e) {
        e.preventDefault();
        const fileInput = document.getElementById('transcriptFile');
        if (!fileInput.files.length) return;

        const formData = new FormData();
        formData.append('requirementFile', fileInput.files[0]);

        const btn = document.querySelector('#uploadTranscriptForm button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = 'Uploading & Syncing…';
        btn.disabled = true;

        try {
            const response = await fetch('/api/upload-transcript', {
                method: 'POST',
                body:   formData
            });
            const data = await response.json();
            if (data.success) {
                alert('Transcript uploaded! Requirements will be synced on next page load.');
            } else {
                alert(`Upload error: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Failed to upload transcript. Please try again.');
        } finally {
            btn.innerText = originalText;
            btn.disabled  = false;
        }
    }

    // ----------------------------------------------------------
    // 11. PDF DOWNLOAD
    // ----------------------------------------------------------
    downloadTimetable() {
        const element = document.getElementById('timetableContainer');
        const btns    = element.querySelectorAll('.remove-btn');
        btns.forEach(b => b.style.display = 'none');

        html2pdf().set({
            margin:      0.5,
            filename:    'Timetable.pdf',
            image:       { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF:       { unit: 'in', format: 'letter', orientation: 'landscape' }
        }).from(element).save().then(() => {
            btns.forEach(b => b.style.display = 'block');
        });
    }
}

const courseManager = new CourseManager();
