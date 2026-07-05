import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { NATIONAL_SCHOOLS } from './nationalSchools';

// We need to set the workerSrc for pdfjs-dist. 
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedData {
  schoolName: string;
  department: string;
  gender: string;
  admittedCount: string;
  year: string;
  region: string;
  students: Student[];
}

export interface Student {
  ticketNumber: string;
  name: string;
  department?: string;
  schoolName?: string;
  region?: string;
  year?: string;
}


const ALIASES: Record<string, string> = {
  "中大壢中": "國立中央大學附屬中壢高中",
  "中山女高": "市立中山女中",
  "建中": "市立建國中學",
  "附中": "國立師大附中",
  "師大附中": "國立師大附中",
  "政大附中": "國立政大附中",
  "竹科實中": "國立竹科實驗高級中等學校",
  "嘉科實中": "國立嘉科實驗高中",
  "高科實中": "國立高科實驗高中",
  "屏科實中": "國立屏科實驗高中",
};

function normalizeSchoolName(name: string): string {
  let res = name.replace(/\s+/g, '');
  res = res.replace(/^(?:財團法人|天主教|市立|國立|縣立|私立)/g, '');
  res = res.replace(/^(臺北|台北|新北|桃園|臺中|台中|臺南|台南|高雄|基隆|新竹|嘉義|宜蘭|苗栗|彰化|南投|雲林|屏東|臺東|台東|花蓮|澎湖|金門|連江)(市立|縣立|私立|國立)/, '$1');
  res = res.replace(/^(?:市立|國立|縣立|私立)/g, '');
  
  const suffixes = [
    "高級中等學校", "高級中學", "高級職業學校", "高級工業職業學校", "高級商業職業學校", "高級家事商業職業學校", "高級農業職業學校", "高級海事水產職業學校",
    "女子高級中學", "高中", "女高", "女中", "高職", "高工", "高商", "家商", "農工", "工商", "商工", "工家", "家職", "商水", "海事水產", "海事", 
    "附屬中學", "附屬高級中學", "附屬中壢高級中學", "進修學校", "實驗高級中等學校", "實驗高級中學", "實驗高中", "實中", "中學"
  ];
  for (const s of suffixes) {
    if (res.endsWith(s)) {
      res = res.substring(0, res.length - s.length);
      break;
    }
  }
  return res;
}


const CITY_TO_EXAM_REGION: Record<string, string> = {
  '臺北市': '基北區', '台北市': '基北區', '新北市': '基北區', '基隆市': '基北區',
  '宜蘭縣': '宜蘭區',
  '桃園市': '桃連區',
  '新竹市': '竹苗區', '新竹縣': '竹苗區', '苗栗縣': '竹苗區',
  '臺中市': '中投區', '台中市': '中投區', '南投縣': '中投區',
  '彰化縣': '彰化區', // Note: 中投區 also has 彰化縣 in user's prompt, but 彰化區 is 彰化縣. If both, just use 彰化區 or 中投區 based on something? Let's default to 彰化區 for 彰化縣, except wait: user said "中投區：臺中市、彰化縣、南投縣。 彰化區：彰化縣。" We'll map 彰化縣 to 彰化區.
  '雲林縣': '雲林區',
  '嘉義市': '嘉義區', '嘉義縣': '嘉義區',
  '臺南市': '臺南區', '台南市': '臺南區',
  '高雄市': '高雄區',
  '屏東縣': '屏東區',
  '花蓮縣': '花蓮區',
  '臺東縣': '臺東區', '台東縣': '臺東區',
  '澎湖縣': '澎湖區',
  '金門縣': '金門區',
  '連江縣': '桃連區'
};

export function getExamRegionFromSchool(schoolName: string): string {
  const school = NATIONAL_SCHOOLS.find(s => s.name === schoolName);
  if (school && school.region) {
    // some nationalSchools might have regions like 桃園市
    if (CITY_TO_EXAM_REGION[school.region]) {
      return CITY_TO_EXAM_REGION[school.region];
    }
  }
  return '';
}

export function matchOfficialSchoolName(parsedName: string): string {
  if (!parsedName) return parsedName;
  if (ALIASES[parsedName]) return ALIASES[parsedName];
  
  const names = NATIONAL_SCHOOLS.map(s => s.name);
  if (names.includes(parsedName)) return parsedName;
  
  const clean = normalizeSchoolName(parsedName);
  
  let bestMatch = "";
  let bestScore = -1;
  
  for (const school of NATIONAL_SCHOOLS) {
    const nsClean = normalizeSchoolName(school.name);
    if (!nsClean) continue;
    
    const regionPrefix = school.region.replace(/[市縣區]$/, '');
    const nsCleanWithRegion = normalizeSchoolName(regionPrefix + school.name);
    
    let score = 0;
    if (nsClean === clean || nsCleanWithRegion === clean) {
      score = 100 + nsClean.length; // Exact match heavily favored
    } else if (clean.length >= 2 && nsClean.includes(clean)) {
      score = clean.length;
    } else if (nsClean.length >= 2 && clean.includes(nsClean)) {
      score = nsClean.length;
    }
    
    if (score > 0) {
      // Bonus if the parsed name includes the region
      if (parsedName.includes(regionPrefix)) {
        score += 0.5; 
      }
      
      // Type matching heuristics to distinguish schools with same base name
      if (parsedName.includes('商') && school.name.includes('商')) score += 2;
      if (parsedName.includes('工') && school.name.includes('工')) score += 2;
      if (parsedName.includes('農') && school.name.includes('農')) score += 2;
      if (parsedName.includes('家') && school.name.includes('家')) score += 2;
      if (parsedName.includes('海事') && school.name.includes('海事')) score += 2;
      if (parsedName.includes('水產') && school.name.includes('水產')) score += 2;
      if (parsedName.includes('女') && school.name.includes('女')) score += 2;
      
      const isGeneral = !/[商工農家海水]/.test(parsedName);
      if (isGeneral && (school.name.includes('高中') || school.name.includes('中學'))) score += 1.5;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = school.name;
      }
    }
  }
  
  return bestMatch || parsedName;
}

const DEPARTMENT_CODE_MAP: Record<string, string> = {
  "101": "普通科", "102": "音樂班", "103": "美術班", "104": "舞蹈班", "105": "體育班",
  "106": "數理資優班", "107": "語文資優班", "108": "科學班", "111": "原住民藝能班", "121": "雙語部",
  "122": "戲劇班", "301": "機械科", "302": "鑄造科", "304": "板金科", "331": "機工科",
  "332": "機械木模科", "337": "配管科", "338": "模具科", "360": "機電科", "363": "製圖科",
  "371": "電腦繪圖科", "372": "生物產業機電科", "374": "電腦機械製圖科", "205": "農業機械科", "303": "汽車科",
  "335": "汽車修護科", "364": "重機科", "381": "飛機修護科", "392": "動力機械科", "305": "資訊科",
  "306": "電子科", "307": "控制科", "308": "電機科", "309": "冷凍空調科", "384": "航空電子科",
  "703": "電子通信科", "315": "化工科", "319": "紡織科", "352": "染整科", "367": "環境檢驗科",
  "311": "建築科", "365": "土木科", "397": "消防工程科", "215": "農產行銷科", "401": "商業經營科",
  "402": "國際貿易科", "403": "會計事務科", "404": "資料處理科", "405": "文書事務科", "418": "不動產事務科",
  "425": "電子商務科", "426": "流通管理科", "706": "水產經營科", "717": "航運管理科", "419": "應用外語科(英文組)",
  "421": "應用外語科(日文組)", "312": "家具木工科", "316": "美工科", "318": "美術工藝科", "361": "陶瓷工程科",
  "366": "室內空間設計科", "373": "圖文傳播科", "394": "金屬工藝科", "399": "家具設計科", "406": "廣告設計科",
  "430": "多媒體設計科", "431": "多媒體應用科", "512": "室內設計科", "201": "農場經營科", "202": "園藝科",
  "204": "森林科", "214": "野生動物保育科", "216": "造園科", "217": "畜產保健科", "206": "食品加工科",
  "505": "食品科", "517": "烘培科", "718": "水產食品科", "501": "家政科", "502": "服裝科", "503": "幼兒保育科",
  "504": "美容科", "513": "時尚模特兒科", "514": "照顧服務科", "515": "流行服飾科", "516": "時尚造型科",
  "407": "觀光事業科", "408": "餐飲管理科", "424": "餐飲服務科", "427": "餐旅管理科", "701": "漁業科",
  "705": "水產養殖科", "702": "輪機科", "708": "航海科", "801": "戲劇科", "802": "音樂科", "803": "舞蹈科",
  "804": "美術科", "806": "影劇科", "807": "西樂科", "808": "國樂科", "809": "歌仔戲科", "813": "劇場藝術科",
  "816": "電影電視科", "817": "表演藝術科", "820": "多媒體動畫科", "821": "客家戲科", "822": "時尚工藝科",
  "823": "戲曲音樂科", "824": "京劇科", "825": "民俗技藝科", "901": "綜合職能科", "196": "綜合高中"
};

export async function extractDataFromPdf(file: File): Promise<ParsedData> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  
  let fullText = "";
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Sort items by Y descending, then X ascending to read top-to-bottom, left-to-right
    // Note: PDF coordinates: origin is bottom-left.
    const items = textContent.items.map((item: any) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height
    }));

    items.sort((a: any, b: any) => {
      if (Math.abs(a.y - b.y) > 5) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    let pageText = '';
    let lastY = null;
    for (const item of items) {
      if (lastY !== null && Math.abs(item.y - lastY) > 5) {
        pageText += '\n';
      } else if (lastY !== null) {
        pageText += ' ';
      }
      pageText += item.str;
      lastY = item.y;
    }

    fullText += pageText + "\n";
    pageTexts.push(pageText);
  }

  const hasTicketHeader = fullText.includes('准考證') || fullText.includes('報名序號') || fullText.includes('錄取編號') || fullText.includes('會考編號') || fullText.includes('報名號碼') || fullText.includes('序號') || fullText.includes('准考號');
  const hasStudentIdHeader = fullText.includes('學號');
  const isStudentIdOnly = hasStudentIdHeader && !hasTicketHeader;

  let students: Student[] = [];
  const seenSignatures = new Set<string>();

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i];
    // Extract department for this page
    let pageDept = '';
    for (const [code, name] of Object.entries(DEPARTMENT_CODE_MAP)) {
      if (pageText.includes(`${code} ${name}`) || pageText.includes(`${code}${name}`) || pageText.includes(`${code}  ${name}`)) {
        pageDept = name;
        break;
      }
    }
    if (!pageDept) {
      const exactDeptMatch = pageText.match(/(?:科\s*組\s*名\s*稱|科\s*別|報\s*名\s*科\s*別)[:：\s]*(\d{2,3})?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15}(?:科|學程|班|群|部))(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/);
      if (exactDeptMatch) {
        if (exactDeptMatch[1] && DEPARTMENT_CODE_MAP[exactDeptMatch[1]]) {
          pageDept = DEPARTMENT_CODE_MAP[exactDeptMatch[1]];
        } else {
          pageDept = exactDeptMatch[2];
        }
      } else {
        const deptCodeMatch = pageText.match(/(\d{3})\s+([\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:科|學程|班|群|部))(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/);
        if (deptCodeMatch) {
          if (DEPARTMENT_CODE_MAP[deptCodeMatch[1]]) {
            pageDept = DEPARTMENT_CODE_MAP[deptCodeMatch[1]];
          } else {
            pageDept = deptCodeMatch[2];
          }
        } else {
          const deptRegex = /(?:[\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:科|學程|班|群|部))(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/g;
          const deptMatches = pageText.match(deptRegex) || [];
          for (const match of deptMatches) {
            if (match.length >= 2 && match.length <= 15 && !match.includes('學科') && !match.includes('專科') && !match.includes('國中部') && !match.includes('中學部') && !match.includes('小學部') && !match.includes('縣立') && !match.includes('市立') && !match.includes('國立') && !match.includes('私立') && !match.includes('和群') && !match.includes('國民')) {
              pageDept = match;
              break;
            }
          }
        }
      }
    }

    // Check table format for this page specifically
    const tableResult = extractTableFormat(pageText, isStudentIdOnly);
    if (tableResult && tableResult.students.length > 0) {
      for (let j = 0; j < tableResult.students.length; j++) {
        const s = tableResult.students[j];
        const sig = s.ticketNumber ? `${s.ticketNumber}-${s.name}` : `page${i}-table${j}-${s.name}`;
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          students.push({ ...s, department: s.department || pageDept });
        }
      }
    } else {
      // Fallback
      const fallbackRegex = /\b\d{9}\b/gi;
      const avoidPattern = /^\d{2,4}$/;
      let pageTickets = !isStudentIdOnly ? (pageText.match(fallbackRegex) || []) : [];
      pageTickets = pageTickets.filter(t => !avoidPattern.test(t));
      
      const nameRegex = /[\u4e00-\u9fa5]{1,2}[○ＯO0\u25CB◎\u25CE●＊*]+[\u4e00-\u9fa5]{0,3}(?![○ＯO0\u25CB◎\u25CE●＊*])/g;
      let pageNames = (pageText.match(nameRegex) || []) as string[];
      pageNames = pageNames.filter(name => /[○ＯO0\u25CB◎\u25CE●＊*]/.test(name));

      const maxLen = Math.max(pageTickets.length, pageNames.length);
      for (let j = 0; j < maxLen; j++) {
        const ticket = pageTickets[j] || '';
        const name = pageNames[j] || '';
        const sig = ticket ? `${ticket}-${name}` : `page${i}-fb${j}-${name}`;
        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);
        students.push({ ticketNumber: ticket, name: name, department: pageDept } as any);
      }
    }
  }

  // Global info extraction from fullText
  const schoolRegex = /(?:[\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:高級中等學校|高級中學|高中|高工|高商|家商|農商|農工|商工|專科學校|中學|工商))/g;
  let region = '';
  let schoolName = '';
  const schoolMatches = fullText.match(schoolRegex) || [];
  for (const match of schoolMatches) {
    if (!match.includes('免試入學') && !match.includes('委員會') && !match.includes('分發結果') && !match.includes('學年度') && !match.includes('區高級') && !match.includes('就學區') && !/基北區|桃連區|竹苗區|中投區|彰化區|雲林區|嘉義區|臺南區|高雄區|屏東區|花蓮區|臺東區|澎湖區|金門區|宜蘭區/.test(match)) {
      schoolName = match;
      break;
    }
  }
  if (!schoolName) {
    const codeMatch = fullText.match(/\d{6}\s+([\u4e00-\u9fa5A-Za-z0-9]{3,20})/);
    if (codeMatch && !codeMatch[1].includes('准考證')) {
      schoolName = codeMatch[1];
    }
  }
  schoolName = matchOfficialSchoolName(schoolName);
  
  if (!region && schoolName) {
    const autoRegion = getExamRegionFromSchool(schoolName);
    if (autoRegion) region = autoRegion;
  }

  const regionMatch = fullText.match(/\d{3}學年度(基北區|桃連區|竹苗區|中投區|彰化區|雲林區|嘉義區|臺南區|高雄區|屏東區|花蓮區|臺東區|澎湖區|金門區|宜蘭區)/);
  if (regionMatch && !region) region = regionMatch[1];

  let department = students.length > 0 ? (students[0].department || '') : '';

  let gender = '';
  if (fullText.includes('不限') || fullText.includes('男女兼收') || fullText.includes('男女')) gender = '不限';
  else if (fullText.includes('男')) gender = '男';
  else if (fullText.includes('女')) gender = '女';

  // Admitted Count
  let admittedCount = '';
  const countMatch = fullText.match(/(?:錄取人數|名額)[\s:：]*(\d+)/) || fullText.match(/(\d+)\s*名/);
  if (countMatch) {
    admittedCount = countMatch[1];
  } else {
    // Try to find a lone number followed by a date (common in footers like "689 114/07/08")
    const footerCountMatch = fullText.match(/(?:\s|^)(\d+)\s+\d{3}\/\d{2}\/\d{2}/);
    if (footerCountMatch) {
      admittedCount = footerCountMatch[1];
    }
  }
  
  if (!admittedCount) {
     const countMatchFallback = fullText.match(/錄取(\d+)人/);
     if (countMatchFallback) admittedCount = countMatchFallback[1];
  }

  // Year and Region
  let year = '';
  const yearMatch = fullText.match(/(\d{3})(?=學年度)/);
  if (yearMatch) year = yearMatch[1];




  if (!admittedCount && students.length > 0) {
    admittedCount = students.length.toString();
  }

  return {
    schoolName,
    department,
    gender,
    admittedCount,
    year,
    region,
    students: students.map(s => ({ ...s, schoolName: s.schoolName || schoolName, region: (s as any)._region || region, year: year }))
  };
}

export function parseRawText(text: string): ParsedData {
  let allTickets: string[] = [];
  let allNames: string[] = [];
  
  const hasTicketHeader = text.includes('准考證') || text.includes('報名序號') || text.includes('錄取編號') || text.includes('會考編號') || text.includes('報名號碼') || text.includes('序號') || text.includes('准考號');
  const hasStudentIdHeader = text.includes('學號');
  const isStudentIdOnly = hasStudentIdHeader && !hasTicketHeader;

  const ticketRegex = /\b\d{9}\b/gi;
  allTickets = !isStudentIdOnly ? ((text.match(ticketRegex) || []) as string[]).filter(t => !/^\d{2,4}$/.test(t)) : [];

  const nameRegex = /[\u4e00-\u9fa5]{1,2}[○ＯO0\u25CB◎\u25CE●＊*]+[\u4e00-\u9fa5]{0,3}(?![○ＯO0\u25CB◎\u25CE●＊*])/g;
  allNames = ((text.match(nameRegex) || []) as string[]).filter(name => /[○ＯO0\u25CB◎\u25CE●＊*]/.test(name));

  // School Name
  const schoolRegex = /(?:[\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:高級中等學校|高級中學|高中|高工|高商|家商|農商|農工|商工|專科學校|中學|工商))/g;
  let region = '';
  let schoolName = '';
  const schoolMatches = text.match(schoolRegex) || [];
  for (const match of schoolMatches) {
    if (!match.includes('免試入學') && !match.includes('委員會') && !match.includes('分發結果') && !match.includes('學年度') && !match.includes('區高級') && !match.includes('就學區') && !/基北區|桃連區|竹苗區|中投區|彰化區|雲林區|嘉義區|臺南區|高雄區|屏東區|花蓮區|臺東區|澎湖區|金門區|宜蘭區/.test(match)) {
      schoolName = match;
      break;
    }
  }
  if (!schoolName) {
    const codeMatch = text.match(/\d{6}\s+([\u4e00-\u9fa5A-Za-z0-9]{3,20})/);
    if (codeMatch && !codeMatch[1].includes('准考證')) {
      schoolName = codeMatch[1];
    }
  }
  
  schoolName = matchOfficialSchoolName(schoolName);
  
  if (!region && schoolName) {
    const autoRegion = getExamRegionFromSchool(schoolName);
    if (autoRegion) region = autoRegion;
  }

  // Department Name
  let department = '';
  // 0. Try map lookup first based on explicit code + name combinations
  for (const [code, name] of Object.entries(DEPARTMENT_CODE_MAP)) {
    if (text.includes(`${code} ${name}`) || text.includes(`${code}${name}`) || text.includes(`${code}  ${name}`)) {
      department = name;
      break;
    }
  }

  if (!department) {
    // 1. Try exact match with label
    const exactDeptMatch = text.match(/(?:科\s*組\s*名\s*稱|科\s*別|報\s*名\s*科\s*別)[:：\s]*(\d{2,3})?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,15}(?:科|學程|班|群|部))(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/);
    if (exactDeptMatch) {
      if (exactDeptMatch[1] && DEPARTMENT_CODE_MAP[exactDeptMatch[1]]) {
        department = DEPARTMENT_CODE_MAP[exactDeptMatch[1]];
      } else {
        department = exactDeptMatch[2];
      }
    } else {
      // 2. Try 3-digit code format
      const deptCodeMatch = text.match(/(\d{3})\s+([\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:科|學程|班|群|部))(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/);
      if (deptCodeMatch) {
        if (DEPARTMENT_CODE_MAP[deptCodeMatch[1]]) {
          department = DEPARTMENT_CODE_MAP[deptCodeMatch[1]];
        } else {
          department = deptCodeMatch[2];
        }
      } else {
        // 3. General fallback
        const deptRegex = /(?:[\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:科|學程|班|群|部))(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/g;
        const deptMatches = text.match(deptRegex) || [];
        for (const match of deptMatches) {
          if (match.length >= 2 && match.length <= 15 && !match.includes('學科') && !match.includes('專科') && !match.includes('國中部') && !match.includes('中學部') && !match.includes('小學部') && !match.includes('縣立') && !match.includes('市立') && !match.includes('國立') && !match.includes('私立') && !match.includes('和群') && !match.includes('國民') && (!schoolName || !schoolName.includes(match))) {
            department = match;
            break;
          }
        }
      }
    }
  }

  // Gender
  let gender = '';
  if (text.includes('不限') || text.includes('男女兼收') || text.includes('男女')) gender = '不限';
  else if (text.includes('男')) gender = '男';
  else if (text.includes('女')) gender = '女';

  // Admitted Count
  let admittedCount = '';
  const countMatch = text.match(/(?:錄取人數|名額)[\s:：]*(\d+)/) || text.match(/(\d+)\s*名/);
  if (countMatch) {
    admittedCount = countMatch[1];
  } else {
    const footerCountMatch = text.match(/(?:\s|^)(\d+)\s+\d{3}\/\d{2}\/\d{2}/);
    if (footerCountMatch) {
      admittedCount = footerCountMatch[1];
    }
  }
  if (!admittedCount) {
     const countMatchFallback = text.match(/錄取(\d+)人/);
     if (countMatchFallback) admittedCount = countMatchFallback[1];
  }

  // Year and Region
  let year = '';
  const yearMatch = text.match(/(\d{3})(?=學年度)/);
  if (yearMatch) year = yearMatch[1];

  const regionMatch = text.match(/\d{3}學年度(基北區|桃連區|竹苗區|中投區|彰化區|雲林區|嘉義區|臺南區|高雄區|屏東區|花蓮區|臺東區|澎湖區|金門區|宜蘭區)/);
  if (regionMatch) region = regionMatch[1];

  const tableResult = extractTableFormat(text, isStudentIdOnly);
  let students: Student[] = tableResult ? tableResult.students : [];
  if (tableResult && tableResult.region && !region) region = tableResult.region;
  
  if (students.length === 0) {
    const maxLen = Math.max(allTickets.length, allNames.length);
    const seenSignatures = new Set<string>();

    for (let i = 0; i < maxLen; i++) {
      const ticket = allTickets[i] || '';
      const name = allNames[i] || '';
      const sig = ticket ? `${ticket}-${name}` : `fb${i}-${name}`;

      if (seenSignatures.has(sig)) {
        continue;
      }
      seenSignatures.add(sig);

      students.push({
        ticketNumber: ticket,
        name: name,
        department: department
      });
    }
  }

  if (!admittedCount && students.length > 0) {
    admittedCount = students.length.toString();
  }

  return {
    schoolName,
    department,
    gender,
    admittedCount,
    year,
    region,
    students: students.map(s => ({ ...s, schoolName: s.schoolName || schoolName, region: (s as any)._region || region, year: year }))
  };
}

function extractTableFormat(text: string, isStudentIdOnly: boolean = false): { students: Student[], region: string } | null {
  const lines = text.split('\n');
  const students: Student[] = [];
  const seenSignatures = new Set<string>();
  
  let validLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const names = Array.from(trimmed.matchAll(/[\u4e00-\u9fa5]{1,2}[○ＯO0\u25CB◎\u25CE●＊*]+[\u4e00-\u9fa5]{0,3}(?![○ＯO0\u25CB◎\u25CE●＊*])/g)).map(m => m[0]);
    
    if (names.length > 0) {
      const regions = Array.from(trimmed.matchAll(/([\u4e00-\u9fa5]{1,3}(?:區|市|縣))/g))
        .map(m => m[1])
        .filter(r => r !== '新生專區' && r !== '報到專區' && r !== '資訊專區');
      const depts = Array.from(trimmed.matchAll(/([\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:科|學程|班|群|部)(?:\([\u4e00-\u9fa5]+\)|（[\u4e00-\u9fa5]+）)?)(?!(?:國民中學|國中|小學|中學|高級中學|學校|高中|高職|國小))/g))
        .map(m => m[1])
        .filter(d => !d.includes('學科') && !d.includes('專科') && !d.includes('委員會') && !d.includes('國中部') && !d.includes('中學部') && !d.includes('小學部') && !d.includes('縣立') && !d.includes('市立') && !d.includes('國立') && !d.includes('私立') && !d.includes('和群') && !d.includes('國民'));
        
      const tokens = trimmed.split(/\s+/);
      
      validLines++;
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        
        let ticket = '';
        const nameIndex = tokens.indexOf(name);
        
        const idPattern = /^\d{9}$/;
        const avoidPattern = /^\d{2,4}$/;
        
        if (!isStudentIdOnly) {
          if (nameIndex > 0) {
            const prevToken = tokens[nameIndex - 1];
            if (idPattern.test(prevToken) && !avoidPattern.test(prevToken)) {
              ticket = prevToken;
            }
          }
          
          if (!ticket && nameIndex !== -1 && nameIndex < tokens.length - 1) {
            const nextToken = tokens[nameIndex + 1];
            if (idPattern.test(nextToken) && !avoidPattern.test(nextToken)) {
              ticket = nextToken;
            }
          }

          if (nameIndex === -1) { 
             const inlinePattern = `(\\d{9})${name}`;
             const inlineTicketMatch = trimmed.match(new RegExp(inlinePattern)); 
             if (inlineTicketMatch && !avoidPattern.test(inlineTicketMatch[1])) { 
               ticket = inlineTicketMatch[1]; 
             }
          } 
          
          if (!ticket) { 
             const fallbackRegex = /\b(\d{9})\b/g;
             const ticketsFallback = Array.from(trimmed.matchAll(fallbackRegex)).map(m => m[1]).filter(t => !avoidPattern.test(t)); 
             if (ticketsFallback.length > i) ticket = ticketsFallback[i];
          }
        }

        const sig = ticket ? `${ticket}-${name}` : `line${validLines}-pos${i}-${name}`;
        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);
        
        let dept = depts.length > i ? depts[i] : (depts[0] || '');
        let reg = regions.length > i ? regions[i] : (regions[0] || '');
        
        if (dept === '新生專區' || dept === '准考證') {
          dept = '';
        }
        
        students.push({ ticketNumber: ticket, name: name, department: dept, _region: reg } as any);
      }
    }
  }
  
  if (validLines > 3) {
    const bestRegion = students.length > 0 ? (students[0] as any)._region : '';
    return { students, region: bestRegion };
  }
  return null;
}