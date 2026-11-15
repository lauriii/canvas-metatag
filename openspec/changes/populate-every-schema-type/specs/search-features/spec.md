## ADDED Requirements

### Requirement: Job postings are judged on the job feature's rules

The job posting feature MUST need a title, a description, a posted date, an
employer and either a workplace with an address or fully remote work with
applicant countries. A description equal to the title MUST read "Needs a full
job description". A job whose closing date has passed MUST read "Not shown:
this job closed ‹date›" in gray, and its markup MUST still ship.

#### Scenario: A remote job without countries

- **WHEN** a job is fully remote and lists no applicant countries
- **THEN** "Job posting" MUST read "Needs who can apply from"

#### Scenario: A closed job

- **WHEN** a job's closing date was 31 Oct 2026 and today is 13 Nov 2026
- **THEN** "Job posting" MUST read "Not shown: this job closed 31 Oct 2026", and the JobPosting node MUST still be in the graph

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

### Requirement: Product variants are judged on templates only

Product variants MUST need the family's name and, on each variant, a SKU or
GTIN. On a Canvas page, a product with several prices MUST read "Doesn't fit:
several prices on one product" for merchant listings, with no fix toward it.

#### Scenario: A variant without identifiers

- **WHEN** a product with a family has neither a SKU nor a GTIN
- **THEN** "Product variants" MUST read "Needs a SKU or GTIN per product"

### Requirement: A return policy is judged at Site

The return policy feature MUST need either a returns page or the countries
and the category, and the number of days when the window is fixed.

#### Scenario: A fixed window without days

- **WHEN** the policy says "Within a number of days" with countries and no days
- **THEN** "Return policy" MUST read "Needs the number of days"

### Requirement: Required values must be ones the feature accepts

The rules file MUST list, per feature, the values it accepts for its coded
properties (employment types, work location, units, availability, types). A
fact whose value is not accepted MUST count as missing; when the fact is
required, the verdict MUST name it.

#### Scenario: A hand-added remote job with a made-up work location

- **WHEN** a hand-added JobPosting has `jobLocationType` "Remote", applicant countries and no `jobLocation`
- **THEN** "Job posting" MUST read "Needs a valid work location"
