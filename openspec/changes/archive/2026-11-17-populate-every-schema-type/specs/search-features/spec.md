## ADDED Requirements

### Requirement: Job postings are judged on the job feature's rules

The job posting feature MUST need a title, a description, a posted date, an
employer, a workplace with an address unless the work is fully remote, and,
whenever the work may be remote, the countries people can apply from. A description equal to the title MUST read "Needs a full
job description". A job whose closing date has passed MUST read "Not shown:
this job closed ‹date›" in gray, and its markup MUST still ship.

#### Scenario: A remote job without countries

- **WHEN** a job is fully remote and lists no applicant countries
- **THEN** "Job posting" MUST read "Needs the countries people can apply from"

#### Scenario: Work on site or remote

- **WHEN** a job's work is on site or remote, its workplace has an address, and it lists no applicant countries
- **THEN** "Job posting" MUST read "Needs the countries people can apply from"

#### Scenario: A closed job

- **WHEN** a job's closing date was 31 October 2026 and today is 13 November 2026
- **THEN** "Job posting" MUST read "Not shown: this job closed 31 October 2026" in gray, and the JobPosting node MUST still be in the graph

### Requirement: Recipes, places and courses get their own verdicts

A recipe MUST need a name and an image. A place people visit MUST be judged
as a local business, needing a name and an address, unless it is a venue
that is not a business, which MUST read "No search feature". A course list
MUST need a list page whose linked courses are at least three that are each
complete on their own page; a course alone MUST read "Needs a list page with
at least 3 courses" in gray.

#### Scenario: A venue

- **WHEN** a page is described as a place people visit of the kind "A venue (not a business)"
- **THEN** its only verdict MUST be "No search feature"

#### Scenario: An incomplete course on the list

- **WHEN** a list page links five pages, three of them courses and one of those without a description
- **THEN** "Course list" MUST read "Needs at least 3 courses: 2 of the 5 linked pages are complete courses"

#### Scenario: A course alone and a full list

- **WHEN** a page is described as a course, and a list page links four complete courses
- **THEN** the course MUST read "Course list: Needs a list page with at least 3 courses" in gray, and the list page "Course list: Can show: 4 courses"

### Requirement: Required values must be ones the feature accepts

The rules file MUST list, per feature, the values it accepts for the coded
properties the module's facts emit as bare codes: a job's employment types,
work location and pay unit. Which types a feature applies to is its `on`
list. A fact whose value is not accepted MUST count as missing; when the
fact is required, the verdict MUST name that fact, even where another one
would also satisfy the requirement.

#### Scenario: A hand-added remote job with a made-up work location

- **WHEN** a hand-added JobPosting has `jobLocationType` "Remote", applicant countries and no `jobLocation`
- **THEN** "Job posting" MUST read "Needs where the work is"
