export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    const { fileData, mimeType, description } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({ error: '파일 데이터가 필요합니다.' });
    }

    const prompt = `
당신은 도로 교통 위반(꼬리물기) 자동 신고 시스템 AI입니다.
업로드된 블랙박스 미디어(이미지/영상)와 설명을 바탕으로 다음 5단계 분석을 수행하고 JSON 형식으로만 답변하세요.

1. 꼬리물기 자동 탐지/판단: 신호 상태 및 교차로 내부(Yellow Box) 체류 여부 판단
2. 억울함/예외상황 정밀 필터링: 돌발 고장, 무단횡단, 사고 등 어쩔 수 없이 갇힌 상황인지 감지하여 실시간 위반 의도성 필터링
3. 증거 영상/사진 자동 편집: 크롭(Crop) 구간 및 신호등/번호판 식별 정지컷 추출 내역
4. 번호판 & 위반 정보 자동 추출: 차량 번호판, 위반 일시, 위반 위치 텍스트화
5. 안전신문고 양식 자동 매핑: 제출 가능한 정식 신고서 형태로 작성

추가 사용자 설명: ${description || '없음'}

반드시 아래 키 구조를 가진 유효한 JSON으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
{
  "isViolation": true 또는 false,
  "detection": "1단계 분석 내용",
  "filtering": "2단계 분석 내용",
  "editing": "3단계 분석 내용",
  "extraction": "4단계 분석 내용",
  "reportForm": "5단계 안전신문고 신고 양식 텍스트"
}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: fileData
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return res.status(response.status).json({ error: 'Gemini API 호출에 실패했습니다.' });
    }

    const result = await response.json();
    const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: 'AI 응답 데이터를 읽을 수 없습니다.' });
    }

    const jsonResult = JSON.parse(candidateText);
    return res.status(200).json(jsonResult);

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다: ' + error.message });
  }
}