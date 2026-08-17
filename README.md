# מגרש בקליק

שריון מגרש כדורגל בלחיצה. כל בעל מגרש מקבל כתובת ייחודית (`/ramat-gan`) והלקוחות שומרים שעה — השריון נסגר רק אחרי לחיצה על קישור ב-SMS.

## הרצה מקומית

1. התקינו PostgreSQL וצרו מסד `mgrashbaklik` (ראה למטה)
2. העתיקו `.env.example` ל-`.env` והתאימו סיסמאות
3. הריצו:

```bash
npm install
npm run db:setup
npm run dev
```

פתחו [http://localhost:3000](http://localhost:3000)

- דף בית: `/`
- מגרש דמו: `/ramat-gan`
- כניסת בעל מגרש: `/ramat-gan/login` (משתמש `ramatgan` / סיסמת `ramat123`)
- מנהל מערכת: `/platform/login`

## זרימת שריון

1. הלקוח בוחר תאריך ושעה, ממלא שם וטלפון
2. השעה נשמרת כ-HOLD ל-15 דקות
3. נשלח SMS עם קישור אישור
4. רק אחרי הלחיצה הסטטוס הופך ל-CONFIRMED
5. אם אין לחיצה — ה-cron משחרר את השעה

בפיתוח מקומי בלי מפתחות 019, הקישור מוצג במסך כדי שאפשר לבדוק את הזרימה.

## SMS (019)

חשבון [019 SMS](https://019sms.co.il) — תשלום לפי הודעה.

1. אשרו מזהה שולח חדש (`source`, עד 11 תווים באנגלית/ספרות), למשל `MgrashBclk`
2. ב-Render הגדירו: `SMS_019_USERNAME`, `SMS_019_TOKEN`, `SMS_019_SOURCE`

תיעוד: https://docs.019sms.co.il/

## פריסה ל-Render + GitHub

1. ריפו GitHub חדש (לא אותו ריפו של ספר בקליק)
2. Web Service `mgrash-baklik` + PostgreSQL נפרד
3. Cron Job כל 5 דקות אל `/api/cron/expire-holds`
4. משתנים: `DATABASE_URL`, `AUTH_SECRET`, `PLATFORM_PASSWORD`, `SMS_019_*`, `CRON_SECRET`, `APP_URL`
