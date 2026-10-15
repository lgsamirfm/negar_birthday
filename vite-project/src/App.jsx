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
      user: "Mahan", 
      profileImage: "mahan.jpg",
      avatarGradient: "from-zinc-400 to-stone-600", 
      text: `نگار عزیزم، تولدت مبارک
امیدوارم سال جدید زندگیت سرشار از آرامش، شادی و اتفاقات زیبا باشه.
برات روزهایی پر از موفقیت، لحظه‌هایی به‌یادموندنی و رسیدن به تمام آرزوهای قشنگت رو آرزو می‌کنم.
همیشه بدرخشی و دلت شاد باشه.`
    },
    { 
      id: 3, 
      user: ".𝐓𝐡𝐞𝐅𝐫𝐞𝐚𝐤", 
      profileImage: "thefreak.jpg", // Letter fallback working example
      avatarGradient: "from-fuchsia-500 to-purple-600", 
      text: `زادروزت خجسته دختر ناناز 🤍 
      امیدوارم سال خوشگل‌تری داشته باشی`
    },
    { 
      id: 4, 
      user: "Naku", 
      profileImage: "naku.jpg",
      avatarGradient: "from-emerald-400 to-teal-500", 
      text: "میو نگار تولدت مبارکهههه ✨🥳 انشاالله همه ارزو هات براورده بشه به این مناسبت و خوشحال باشیییی" 
    },
    { 
      id: 5, 
      user: "Midnight", 
      profileImage: "midnight.jpg",
      avatarGradient: "from-amber-400 to-orange-500", 
      text: `نگار جان عزیزم
امیدوارم که همیشه خودت و خانوادت و دوستات و عزیزانت حالتون عالی باشه و سالم و سلامت باشین به دور از هر بلا، زندگی به کامت باشه و به تمام ارزو های قشنگت هم برسی
تولدت مبارک💕💕`

    },
    { 
      id: 6, 
      user: "M", 
      profileImage: "",
      avatarGradient: "from-blue-400 to-indigo-500", 
      text: `الان ۲۱ ساله که از نیگا بودنت میگذره و امیدوارم ۱۰۰ سال دیگه نیگا بمونی؛ همچنین امیدوارم که ۲۲ سالگیتو بدون آخوند جشن بگیری.
      زادروزت رو به خودت و تموم نیگاها تبریک میگم.💚💐` 
    },
    
    { 
      id: 7, 
      user: "Diktator_y", 
      profileImage: "diktator_y.jpg",
      avatarGradient: "from-cyan-400 to-blue-500", 
      text: `سلاااام نگااااااار چطوریییییی؟
میدونم خیلی وقته صحبت نکردیم و نمیکنیم ولی خب متوجه شدم تولدته و خواستم بهت تبریک بگم و بگم که یادم نرفتت و هر چند وقت یک بار بهت فکر میکنم. امیدوارم که سال جدید برات پر از دستاورد باشه به همه هدفات برسی مثل پزشکی که بهش رسیدی و برای اون هم خیلی بهت تبریک میگم
مراقبت کن و خوش بگذرون و از زندگی لذت ببر❤️🤝`
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