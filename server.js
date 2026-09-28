import express from "express";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// مفتاح OpenAI راح ناخذه من ملف .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// نخزن الصورة مؤقتاً بالذاكرة
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.use(express.json({ limit: "15mb" }));

// ملفات واجهة البرنامج
app.use(express.static("public"));


// ==========================
// قراءة صورة الفاتورة
// ==========================

app.post(
  "/api/read-receipt",
  upload.single("receipt"),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: "اختاري صورة الفاتورة أولاً."
        });
      }

      // نتأكد أن الملف صورة
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: "صيغة الصورة غير مدعومة."
        });
      }

      // تحويل الصورة إلى Base64
      const imageBase64 =
        req.file.buffer.toString("base64");

      const imageData =
        `data:${req.file.mimetype};base64,${imageBase64}`;


      // إرسال الفاتورة إلى OpenAI
      const response =
        await openai.responses.create({

          model: "gpt-5.4-mini",

          input: [
            {
              role: "user",

              content: [

                {
                  type: "input_text",

                  text: `
أنت نظام متخصص بقراءة فواتير المشتريات.

اقرأ صورة الفاتورة المرفقة بعناية.

قد تكون الفاتورة:
- بالعربية
- بالإنجليزية
- أو بالعربية والإنجليزية معاً.

استخرج المعلومات التالية:

1. تاريخ الفاتورة.
2. اسم المتجر أو الماركت.
3. كل سلعة موجودة في الفاتورة.
- انسخ اسم كل سلعة حرفياً كما هو مكتوب في الفاتورة.
- لا تصحح اسم السلعة ولا تعيد صياغته ولا تستبدله بكلمة تتوقعها.
- دقق اسم السلعة بصرياً حرفاً حرفاً قبل إرجاع النتيجة.
- إذا كان جزء من اسم السلعة غير واضح، اكتب فقط الجزء المقروء ولا تخمّن الجزء غير الواضح.
4. كمية كل سلعة.
5. سعر الوحدة إذا كان موجوداً.
6. السعر الإجمالي لكل سلعة.
7. المجموع النهائي للفاتورة.
8. العملة.

بالنسبة للفواتير العراقية:
اعتبر العملة IQD إذا كانت الأسعار بالدينار العراقي.

قواعد مهمة جداً:

- لا تخمّن الأرقام غير الواضحة.
- إذا كانت قيمة غير واضحة ضع null.
- لا تعتبر رقم الهاتف سعراً.
- لا تعتبر رقم الفاتورة سعراً.
- لا تعتبر التاريخ سعراً.
- total يعني المبلغ النهائي المدفوع.
- quantity يجب أن تكون رقماً.
- الأسعار يجب أن تكون أرقاماً بدون فواصل أو كلمات.
- إذا كان اسم السلعة غير واضح، اكتب النص الأقرب وضع uncertain=true.
- إذا كانت السلعة واضحة ضع uncertain=false.

أرجع JSON فقط.

استخدم هذا الشكل:

{
  "date": "YYYY-MM-DD",
  "store": "",
  "items": [
    {
      "name": "",
      "quantity": 1,
      "unitPrice": null,
      "totalPrice": null,
      "uncertain": false
    }
  ],
  "total": null,
  "currency": "IQD"
}
`
                },

                {
                  type: "input_image",
                  image_url: imageData
                }

              ]
            }
          ]
        });


      // النص الذي رجع من الذكاء الاصطناعي
      let text =
        response.output_text.trim();


      // إزالة ```json إذا رجعها النموذج
      text = text
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();


      // تحويل النص إلى JSON
      const receipt =
        JSON.parse(text);


      // حماية إذا items مو Array
      if (!Array.isArray(receipt.items)) {
        receipt.items = [];
      }


      // إرسال النتيجة للتطبيق
      res.json(receipt);

    }

    catch (error) {

      console.error(
        "Receipt error:",
        error
      );

      res.status(500).json({
        error:
          "ما گدرنا نقرا الفاتورة. حاولي بصورة أوضح."
      });

    }

  }
);


// ==========================
// اختبار السيرفر
// ==========================

app.get("/api/test", (req, res) => {

  res.json({
    success: true,
    message: "مصروفي يعمل"
  });

});


// ==========================
// تشغيل السيرفر
// ==========================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `Masroofi started on port ${PORT}`
  );

});
