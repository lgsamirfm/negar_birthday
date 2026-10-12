import { useState } from "react";
import Hero from "./Hero";
import Gallery from "./Gallery";
import Reveal from "./Reveal";
import { navigate, useHashRoute } from "./useHashRoute";

// A clean sub-component that gracefully handles profile images or letter fallbacks
function UserAvatar({ src, user, gradient }) {
  const [hasError, setHasError] = useState(!src);

  return (
    <div className={`w-15 h-15 bg-gradient-to-tr ${gradient} rounded-full p-[2px] shadow-sm group-hover:scale-105 transition-transform duration-300 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {!hasError ? (
        <img 
          src={src} 
          alt={`آواتار ${user}`}
          className="w-full h-full object-cover rounded-full bg-white"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-bold text-sm text-gray-700 select-none">
          {user.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ۲۵ مهر — everything else that shares this date
 *
 * One entry per card, in chronological order. To add or reorder one, just
 * move its object in DAY_EVENTS; nothing else needs to change.
 *
 * IMAGES ARE OPTIONAL AND NOT IN THE REPO YET. Each card looks for its file
 * in public/events/ — create that folder and drop them in with these names:
 *
 *   public/events/eminem.jpg
 *   public/events/poverty-day.jpg
 *   public/events/hung-up.jpg
 *   public/events/bully.jpg
 *   public/events/black-phone-2.jpg
 *
 * Until a file exists (or if it fails to load) the card shows the soft
 * gradient placeholder with its category on it instead, so the section never
 * looks broken. Set `image: ""` on an entry to keep the placeholder on
 * purpose. A portrait crop works best — the box is tall and narrow and
 * `object-cover` fills it from any aspect ratio.
 * ------------------------------------------------------------------ */
const DAY_EVENTS = [
  {
    id: "eminem",
    category: "شخصیت",
    title: "امینم",
    latin: "Eminem",
    year: 1972,
    image: "/events/eminem.jpg",
    imageAlt: "پرتره‌ی امینم",
    text: "مارشال بروس متر سوم تو سنت‌جوزفِ میسوری به دنیا اومد؛ اسم هنری‌اش همون دو حرف اول اسم و فامیل خودشه. سال‌ها بعد با ترانه‌ی Lose Yourself از فیلم هشت مایل، اولین هنرمند هیپ‌هاپ شد که اسکار بهترین ترانه‌ی اصلی رو می‌بره.",
  },
  {
    id: "poverty-day",
    category: "روز جهانی",
    title: "روز جهانی ریشه‌کنی فقر",
    latin: "",
    year: 1987,
    image: "/events/poverty-day.jpg",
    imageAlt: "سنگ یادبود روز جهانی ریشه‌کنی فقر در میدان تروکادروی پاریس",
    text: "هفدهم اکتبر ۱۹۸۷ صد هزار نفر تو میدان تروکادروی پاریس جمع شدن تا به قربانی‌های فقر، گرسنگی و خشونت ادای احترام کنن. ژوزف رسینسکی همون‌جا سنگ یادبودی رو رونمایی کرد که روش نوشته: هرجا زن و مردی به فقر مطلق محکوم باشه، حقوق بشر نقض شده. سازمان ملل سال ۱۹۹۲ این روز رو به رسمیت شناخت.",
  },
  {
    id: "hung-up",
    category: "موسیقی",
    title: "هانگ آپ",
    latin: "Madonna — Hung Up",
    year: 2005,
    image: "/events/hung-up.jpg",
    imageAlt: "جلد تک‌آهنگ هانگ آپ از مدونا",
    text: "تک‌آهنگ اول آلبوم اعتراف‌ها روی زمینِ رقص، که رو ملودی Gimme! Gimme! Gimme! گروه آبا ساخته شده. مدونا برای گرفتن اجازه‌اش شخصاً به بنی آندرسون و بیورن اولویوس نامه نوشت. ترانه تو ۴۱ کشور شماره‌ی یک شد و بیلبورد اون رو موفق‌ترین ترانه‌ی دنس دهه نامید.",
  },
  {
    id: "bully",
    category: "بازی ویدیویی",
    title: "بالی",
    latin: "Bully",
    year: 2006,
    image: "/events/bully.jpg",
    imageAlt: "کاور بازی بالی",
    text: "ساخته‌ی راک‌استار ونکوور برای پلی‌استیشن ۲، که تو اروپا با اسم Canis Canem Edit منتشر شد. جیمی هاپکینزِ پونزده‌ساله که از هفت مدرسه اخراج شده، حالا تو مدرسه‌ی شبانه‌روزی بول‌ورث باید بین زورگوها، خرخون‌ها، پولدارها و ورزشکارها راه خودش رو پیدا کنه.",
  },
  {
    id: "black-phone-2",
    category: "فیلم",
    title: "تلفن سیاه ۲",
    latin: "Black Phone 2",
    year: 2025,
    image: "/events/black-phone-2.jpg",
    imageAlt: "پوستر فیلم تلفن سیاه ۲",
    text: "دنباله‌ی فیلم تلفن سیاه، باز هم با کارگردانی اسکات دریکسون و محصول بلوم‌هاوس و یونیورسال. ایتن هاوک تو نقش گِرَبر برگشته، میسون تیمز دوباره فینی رو بازی می‌کنه و مادلین مک‌گرا هم تو نقش گوِن همراهشونه.",
  },
];

// Persian digits with no thousands separator: «۱۹۷۲» rather than the «۱٬۹۷۲»
// the default fa-IR formatter produces, which reads like a count of things.
const YEAR_FA = new Intl.NumberFormat("fa-IR", { useGrouping: false });

// Same shape as UserAvatar below: try the file, fall back quietly if it is not
// there. A failed <img> is not proof of a missing file on its own, but here
// nothing else can go wrong — these are local paths with no retry to attempt.
function EventImage({ src, alt, label }) {
  const [missing, setMissing] = useState(!src);

  return (
    <div className="w-24 flex-shrink-0 self-stretch overflow-hidden bg-gradient-to-br from-rose-100 via-purple-100 to-amber-100 sm:w-32 md:w-40">
      {!missing ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={() => setMissing(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center">
          <span className="text-[11px] font-black leading-relaxed text-rose-400/70">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

// Between the hero and the messages. Cards match the ones below them exactly —
// same surface, border, shadow and hover lift — so the page reads as one list
// rather than two sections bolted together.
function DayEvents() {
  return (
    <section className="max-w-4xl mx-auto px-4 pt-4 pb-14">
      <Reveal>
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600 shadow-sm">
            ۲۵ مهر · ۱۷ اکتبر
          </span>

          <h2 className="bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 bg-clip-text pb-1 text-2xl font-black text-transparent drop-shadow-sm sm:text-3xl">
            اتفاق‌های این روز
          </h2>

          <p className="max-w-md text-sm font-medium leading-loose text-gray-500 sm:text-base">
            پنج اتفاق که همه‌شون تو هفدهم اکتبر افتادن — از تولد یک رپر تا یک
            روز جهانی.
          </p>
        </div>
      </Reveal>

      <div className="flex flex-col gap-4">
        {DAY_EVENTS.map((event, index) => (
          <Reveal key={event.id} delay={Math.min(index, 4) * 90}>
            <article className="group flex overflow-hidden rounded-3xl border border-rose-100/50 bg-white/70 text-right shadow-[0_4px_20px_-4px_rgba(244,63,94,0.06)] backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-4px_rgba(244,63,94,0.12)]">
              <EventImage
                src={event.image}
                alt={event.imageAlt}
                label={event.category}
              />

              {/* min-w-0 so a long unbroken title cannot force the card wider
                  than the page — a flex item's default min-width is auto. */}
              <div className="flex min-w-0 flex-col gap-2 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 shadow-sm">
                    {event.category}
                  </span>
                  <span className="text-[11px] font-black text-gray-400">
                    {YEAR_FA.format(event.year)}
                  </span>
                </div>

                <h3 className="text-base font-black text-gray-800 sm:text-lg">
                  {event.title}
                </h3>

                {/* dir="ltr" keeps a Latin name from being reordered by the
                    page's RTL flow; text-right lines it up under the title. */}
                {event.latin && (
                  <p dir="ltr" className="text-right text-xs font-semibold text-gray-400">
                    {event.latin}
                  </p>
                )}

                <p className="text-sm font-normal leading-loose text-gray-600">
                  {event.text}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// End-of-page call to action leading to the video gallery
function GalleryCta() {
  return (
    <section className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-rose-100/60 bg-white/70 p-8 text-center shadow-[0_4px_20px_-4px_rgba(244,63,94,0.06)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_10px_30px_-4px_rgba(244,63,94,0.12)] sm:p-10">
      {/* <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600 shadow-sm">
        گالری 🎬
      </span> */}

      <h2 className="bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 bg-clip-text pb-1 text-2xl font-black text-transparent drop-shadow-sm sm:text-3xl">
       اینارم ببین
      </h2>

      <p className="max-w-md text-sm font-medium leading-loose text-gray-500 sm:text-base">
       هرکی تا آخر ندید خره
      </p>

      <button
        type="button"
        onClick={() => navigate("gallery")}
        className="group mt-2 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(244,63,94,0.5)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(244,63,94,0.65)] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 pl-0.5 transition-transform duration-300 group-hover:scale-110">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.14v13.72a1 1 0 001.52.85l11.14-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" />
          </svg>
        </span>
        <span>فیلما رو ببین</span>
      </button>
    </section>
  );
}

function App() {
  const route = useHashRoute();
  // Birthday wishes translated to elegant Persian equivalents
  const birthdayWishes = [
    {
      id: 1,
      user: "Lgsamirfm",
      profileImage: "lg.jpg",
      avatarGradient: "from-purple-500 via-pink-500 to-rose-400",
      text: "نگار عزیز، تولدت رو صمیمانه تبریک می‌گم! امیدوارم سال جدید زندگیت پر از خنده‌ها، موفقیت‌های بزرگ و لحظات فراموش‌نشدنی باشه. بهترین‌ها سهم قلب مهربونت."
    },
    { 
      id: 2, 
      user: "Naku", 
      profileImage: "naku.jpg",
      avatarGradient: "from-emerald-400 to-teal-500", 
      text: "میو نگار تولدت مبارکهههه ✨🥳 انشاالله همه ارزو هات براورده بشه به این مناسبت و خوشحال باشیییی" 
    },
    { 
      id: 3, 
      user: ".𝐓𝐡𝐞𝐅𝐫𝐞𝐚𝐤", 
      profileImage: "thefreak.jpg",
      avatarGradient: "from-amber-400 to-orange-500", 
      text: `زادروزت خجسته دختر ناناز 🤍 
      امیدوارم سال خوشگل‌تری داشته باشی`

    },
    { 
      id: 4, 
      user: "David_Z", 
      profileImage: "https://unsplash.com",
      avatarGradient: "from-blue-400 to-indigo-500", 
      text: "یک سال دیگه از زندگی زیبات گذشت، به سلامتی سال جدید! مشتاقم که به‌زودی این روز رو در کنار هم جشن بگیریم." 
    },
    { 
      id: 5, 
      user: "Elena_R", 
      profileImage: "", // Letter fallback working example
      avatarGradient: "from-fuchsia-500 to-purple-600", 
      text: "تولدت مبارک! از فرسنگ‌ها دورتر گرم‌ترین آغوش‌ها، انرژی‌های مثبت و عشق بی‌پایانم رو برات می‌فرستم." 
    },
    { 
      id: 6, 
      user: "Tom_W", 
      profileImage: "https://unsplash.com",
      avatarGradient: "from-cyan-400 to-blue-500", 
      text: "تقدیم به یک آدم فوق‌العاده؛ امیدوارم روز تولدت مثل خودت درخشان، الهام‌بخش و بی‌نظیر باشه." 
    }
  ];

  // Hash-based view switch: "#/gallery" renders the video gallery page
  if (route === "gallery") {
    return <Gallery />;
  }

  return (
    // dir="rtl" puts the whole page in right-to-left flow for the Persian copy
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FFF5F5] to-[#FFF0FA] antialiased selection:bg-rose-200 selection:text-rose-900"
    >
      <Hero />

      <DayEvents />

      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {birthdayWishes.map((item, index) => (
            // <Reveal> becomes the grid item, so the card needs h-full to keep
            // stretching to its row-mate's height the way it did before.
            <Reveal key={item.id} delay={Math.min(index, 5) * 90}>
              <div 
                className="group h-full p-6 bg-white/70 backdrop-blur-md border border-rose-100/50 flex flex-col justify-between rounded-3xl shadow-[0_4px_20px_-4px_rgba(244,63,94,0.06)] hover:shadow-[0_10px_30px_-4px_rgba(244,63,94,0.12)] hover:-translate-y-0.5 transition-all duration-300 ease-out text-right"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      src={item.profileImage} 
                      user={item.user} 
                      gradient={item.avatarGradient} 
                    />
                    <div>
                      <p className="text-gray-800 font-semibold text-base tracking-tight">{item.user}</p>
                   
                    </div>
                  </div>

                  {/* Fixed line height for smoother Persian font rendering */}
                  <p className="text-gray-600 whitespace-pre-line text-base leading-loose font-normal">
                    {item.text}
                  </p>
                </div>

                {/* Flex direction adjusted so the heart emojis align nicely on the left border side */}
                <div className="mt-4 pt-3 border-t border-rose-50/50 flex justify-end ltr">
                  <span className="text-rose-300 group-hover:text-rose-400 text-xs transition-colors duration-200">✨ ❤️</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* End of the page: doorway to the video gallery */}
        <Reveal delay={80}>
          <GalleryCta />
        </Reveal>
      </div>
    </div>
  );
}

export default App;