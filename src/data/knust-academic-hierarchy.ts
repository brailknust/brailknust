export type KnustDepartment = {
  name: string;
  url?: string;
};

export type KnustProgramme = {
  name: string;
  college: string;
  department: string;
  departmentUrl?: string;
};

export type KnustAcademicUnit = {
  name: string;
  type: "faculty" | "school";
  url?: string;
  departments: KnustDepartment[];
};

export type KnustCollege = {
  name: string;
  url?: string;
  units: KnustAcademicUnit[];
};

export const knustAcademicHierarchySource = {
  title: "All Academic Departments",
  url: "https://www.knust.edu.gh/academics/departments-programmes/departments",
  retrievedAt: "2026-07-15",
} as const;

export const knustAcademicHierarchy: KnustCollege[] = [
  {
    name: "College of Agriculture and Natural Resources",
    url: "https://canr.knust.edu.gh",
    units: [
      {
        name: "Faculty of Agriculture",
        type: "faculty",
        url: "https://agric.knust.edu.gh",
        departments: [
          {
            name: "Department of Agricultural Economics, Agribusiness and Extension",
            url: "https://agric.knust.edu.gh",
          },
          { name: "Department of Animal Science", url: "https://animalscience.knust.edu.gh" },
          { name: "Department of Horticulture", url: "https://horticulture.knust.edu.gh" },
          { name: "Department of Crop and Soil Science", url: "https://css.knust.edu.gh" },
        ],
      },
      {
        name: "Faculty of Renewable Natural Resources",
        type: "faculty",
        url: "https://frnr.knust.edu.gh",
        departments: [
          { name: "Department of Agroforestry", url: "https://frnr.knust.edu.gh" },
          {
            name: "Department of Fisheries and Watershed Management",
            url: "https://frnr.knust.edu.gh",
          },
          {
            name: "Department of Silviculture and Forest Management",
            url: "https://frnr.knust.edu.gh",
          },
          {
            name: "Department of Wildlife and Range Management",
            url: "https://frnr.knust.edu.gh",
          },
          {
            name: "Department of Wood Science and Technology",
            url: "https://frnr.knust.edu.gh",
          },
          {
            name: "Department of Forest Resources Technology",
            url: "https://dfrt.knust.edu.gh",
          },
        ],
      },
    ],
  },
  {
    name: "College of Art and Built Environment",
    url: "https://cap.knust.edu.gh",
    units: [
      {
        name: "Faculty of Art",
        type: "faculty",
        departments: [
          { name: "Department of Communication Design", url: "https://decode.knust.edu.gh" },
          {
            name: "Department of Educational Innovations in Science and Technology",
            url: "https://eist.knust.edu.gh",
          },
          {
            name: "Department of Painting and Sculpture",
            url: "https://painting.knust.edu.gh",
          },
          {
            name: "Department of Indigenous Art and Technology",
            url: "https://irai.knust.edu.gh",
          },
          { name: "Department of Industrial Art", url: "https://industrialart.knust.edu.gh" },
          {
            name: "Department of Publishing Studies",
            url: "https://publishing.knust.edu.gh",
          },
        ],
      },
      {
        name: "Faculty of Built Environment",
        type: "faculty",
        departments: [
          { name: "Department of Architecture", url: "https://architecture.knust.edu.gh" },
          {
            name: "Department of Construction Technology and Management",
            url: "https://bt.knust.edu.gh",
          },
          { name: "Department of Land Economy", url: "https://landeconomy.knust.edu.gh" },
          { name: "Department of Planning", url: "https://planning.knust.edu.gh" },
        ],
      },
      {
        name: "Faculty of Educational Studies",
        type: "faculty",
        url: "https://fes.knust.edu.gh",
        departments: [
          {
            name: "Department of Educational Innovations in Science and Technology",
            url: "https://eist.knust.edu.gh",
          },
          { name: "Department of Teacher Education", url: "https://dte.knust.edu.gh" },
        ],
      },
    ],
  },
  {
    name: "College of Humanities and Social Sciences",
    url: "https://cass.knust.edu.gh",
    units: [
      {
        name: "Faculty of Law",
        type: "faculty",
        url: "https://law.knust.edu.gh",
        departments: [
          { name: "Department of Commercial Law" },
          { name: "Department of Private Law" },
          { name: "Department of Public Law" },
        ],
      },
      {
        name: "Faculty of Social Sciences",
        type: "faculty",
        url: "https://fss.knust.edu.gh",
        departments: [
          { name: "Department of Economics", url: "https://economics.knust.edu.gh" },
          { name: "Department of English", url: "https://english.knust.edu.gh" },
          {
            name: "Department of Geography and Rural Development",
            url: "https://geography.knust.edu.gh",
          },
          {
            name: "Department of History and Political Studies",
            url: "https://histpol.knust.edu.gh",
          },
          { name: "Department of Modern Languages", url: "https://languages.knust.edu.gh" },
          {
            name: "Department of Sociology and Social Work",
            url: "https://sociology.knust.edu.gh",
          },
          {
            name: "Department of Religious Studies",
            url: "https://religions.knust.edu.gh",
          },
        ],
      },
      {
        name: "School of Business",
        type: "school",
        url: "https://business.knust.edu.gh",
        departments: [
          {
            name: "Department of Accounting and Finance",
            url: "https://business.knust.edu.gh",
          },
          {
            name: "Department of Supply Chain and Information Systems",
            url: "https://business.knust.edu.gh",
          },
          {
            name: "Department of Human Resource and Organisational Development",
            url: "https://business.knust.edu.gh",
          },
          {
            name: "Department of Marketing and Corporate Strategy",
            url: "https://business.knust.edu.gh",
          },
          {
            name: "Department of Hospitality and Tourism Studies",
            url: "https://business.knust.edu.gh",
          },
        ],
      },
    ],
  },
  {
    name: "College of Engineering",
    url: "https://coe.knust.edu.gh",
    units: [
      {
        name: "Faculty of Civil and Geo-Engineering",
        type: "faculty",
        url: "https://fcge.knust.edu.gh",
        departments: [
          { name: "Department of Civil Engineering", url: "https://civil.knust.edu.gh" },
          {
            name: "Department of Geological Engineering",
            url: "https://geolenk.knust.edu.gh",
          },
          {
            name: "Department of Geomatic Engineering",
            url: "https://geomatics.knust.edu.gh",
          },
          {
            name: "Department of Petroleum Engineering",
            url: "https://petrol.knust.edu.gh",
          },
        ],
      },
      {
        name: "Faculty of Mechanical and Chemical Engineering",
        type: "faculty",
        url: "https://fmce.knust.edu.gh",
        departments: [
          {
            name: "Department of Agricultural and Biosystems Engineering",
            url: "https://agriceng.knust.edu.gh",
          },
          {
            name: "Department of Chemical Engineering",
            url: "https://chemeng.knust.edu.gh",
          },
          {
            name: "Department of Material Engineering",
            url: "https://mateng.knust.edu.gh",
          },
          {
            name: "Department of Mechanical Engineering",
            url: "https://mech.knust.edu.gh",
          },
        ],
      },
      {
        name: "Faculty of Electrical and Computer Engineering",
        type: "faculty",
        url: "https://fece.knust.edu.gh",
        departments: [
          {
            name: "Department of Computer Engineering",
            url: "https://compeng.knust.edu.gh",
          },
          {
            name: "Department of Electrical and Electronic Engineering",
            url: "https://eleceng.knust.edu.gh",
          },
          {
            name: "Department of Telecommunications Engineering",
            url: "https://teleng.knust.edu.gh",
          },
        ],
      },
    ],
  },
  {
    name: "College of Health Sciences",
    url: "https://chs.knust.edu.gh",
    units: [
      {
        name: "Faculty of Allied Health Sciences",
        type: "faculty",
        url: "https://ahs.knust.edu.gh",
        departments: [
          { name: "Department of Nursing", url: "https://nursing.knust.edu.gh" },
          {
            name: "Department of Sports and Exercise Science",
            url: "https://excercise.knust.edu.gh",
          },
          {
            name: "Department of Medical Diagnostics",
            url: "https://sonography.knust.edu.gh",
          },
        ],
      },
      {
        name: "School of Medicine and Dentistry",
        type: "school",
        url: "https://sms.knust.edu.gh",
        departments: [
          { name: "Department of Anaesthesiology and Intensive Care" },
          { name: "Department of Anatomy" },
          { name: "Department of Behavioural Sciences" },
          { name: "Department of Child Health" },
          { name: "Department of Clinical Microbiology" },
          { name: "Department of Community Health" },
          { name: "Department of Eye, Ear, Nose and Throat" },
          { name: "Department of Medicine" },
          { name: "Department of Molecular Medicine" },
          { name: "Department of Obstetrics and Gynaecology" },
          { name: "Department of Pathology" },
          { name: "Department of Physiology" },
          { name: "Department of Radiology" },
          { name: "Department of Surgery" },
          { name: "Department of Adult Oral Health" },
          { name: "Department of Basic Oral Health" },
          { name: "Department of Community Dentistry" },
          { name: "Department of Oral Health and Orthodontics" },
          { name: "Department of Oral and Maxillofacial Science" },
        ],
      },
      {
        name: "Faculty of Pharmacy and Pharmaceutical Sciences",
        type: "faculty",
        url: "https://pharmacy.knust.edu.gh",
        departments: [
          { name: "Department of Herbal Medicine" },
          { name: "Department of Pharmaceutics" },
          { name: "Department of Pharmacology" },
          { name: "Department of Pharmacognosy" },
          { name: "Department of Pharmaceutical Chemistry" },
          { name: "Department of Pharmacy Practice" },
        ],
      },
      {
        name: "School of Public Health",
        type: "school",
        url: "https://sph.knust.edu.gh",
        departments: [
          {
            name: "Department of Epidemiology and Biostatistics",
            url: "https://epibio.knust.edu.gh",
          },
          { name: "Department of Global and International Health" },
          {
            name: "Department of Health Policy, Management and Economics",
            url: "https://hpme.knust.edu.gh",
          },
          { name: "Department of Health Promotion, Education and Disability" },
          { name: "Department of Occupational and Environmental Health" },
          { name: "Department of Population, Family and Reproductive Health" },
        ],
      },
      {
        name: "School of Veterinary Medicine",
        type: "school",
        url: "https://svm.knust.edu.gh",
        departments: [
          { name: "Department of Veterinary Clinical Studies" },
          { name: "Department of Veterinary Anatomy and Physiology" },
          { name: "Department of Veterinary Pathobiology" },
          { name: "Department of Veterinary Pharmacology and Toxicology" },
          { name: "Department of Veterinary Public Health and Epidemiology" },
        ],
      },
    ],
  },
  {
    name: "College of Science",
    url: "https://cos.knust.edu.gh",
    units: [
      {
        name: "Faculty of Biosciences",
        type: "faculty",
        url: "https://biosciences.knust.edu.gh",
        departments: [
          {
            name: "Department of Biochemistry and Biotechnology",
            url: "https://biochemistry.knust.edu.gh",
          },
          {
            name: "Department of Environmental Science",
            url: "https://envsci.knust.edu.gh",
          },
          {
            name: "Department of Food Science and Technology",
            url: "https://foodscience.knust.edu.gh",
          },
          {
            name: "Department of Optometry and Visual Science",
            url: "https://optometry.knust.edu.gh",
          },
          {
            name: "Department of Theoretical and Applied Biology",
            url: "https://tab.knust.edu.gh",
          },
        ],
      },
      {
        name: "Faculty of Physical and Computational Sciences",
        type: "faculty",
        url: "https://physicom.knust.edu.gh",
        departments: [
          { name: "Department of Chemistry", url: "https://chemistry.knust.edu.gh" },
          { name: "Department of Computer Science", url: "https://cs.knust.edu.gh" },
          { name: "Department of Mathematics", url: "https://math.knust.edu.gh" },
          { name: "Department of Physics", url: "https://physics.knust.edu.gh" },
          {
            name: "Department of Statistics and Actuarial Science",
            url: "https://statacts.knust.edu.gh",
          },
          {
            name: "Department of Meteorology and Climate Science",
            url: "https://meteoclimate.knust.edu.gh",
          },
        ],
      },
    ],
  },
];

export const knustColleges = knustAcademicHierarchy.map((college) => college.name);

export const knustDepartments = knustAcademicHierarchy.flatMap((college) =>
  college.units.flatMap((unit) =>
    unit.departments.map((department) => ({
      college: college.name,
      unit: unit.name,
      department: department.name,
      departmentUrl: department.url,
    })),
  ),
);

export const knustProgrammes: KnustProgramme[] = knustDepartments
  .map((item) => ({
    name:
      item.department === "Department of Computer Engineering"
        ? "Computer Engineering"
        : item.department.replace(/^Department of\s+/i, ""),
    college: item.college,
    department: item.department,
    departmentUrl: item.departmentUrl,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getKnustUnitsForCollege(collegeName: string) {
  return knustAcademicHierarchy.find((college) => college.name === collegeName)?.units ?? [];
}

export function getKnustDepartmentsForUnit(collegeName: string, unitName: string) {
  return (
    getKnustUnitsForCollege(collegeName).find((unit) => unit.name === unitName)?.departments ??
    []
  );
}

export function getKnustProgrammesForCollege(collegeName: string) {
  return knustProgrammes.filter((programme) => programme.college === collegeName);
}

export function findKnustProgramme(collegeName: string, programmeName: string) {
  return knustProgrammes.find(
    (programme) => programme.college === collegeName && programme.name === programmeName,
  );
}
