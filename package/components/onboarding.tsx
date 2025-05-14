
import { useState, useEffect, } from 'react';
import "./onboarding.scss"

export const OnboardingUI = ({ sheetEditorRef }: { sheetEditorRef: React.RefObject<any> }) => {
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    const storedValue = window.localStorage.getItem("onboardingComplete");
    //return true
    return storedValue === "true";
  });
  const [expandInfoContainer, setExpandInfoContainer] = useState(false);
  const [animationState, setAnimationState] = useState('hidden');

  const [currentCard, setCurrentCard] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState('left');

  const nextCard = () => {
    if (animating) return;

    setDirection('left');
    setAnimating(true);
    setTimeout(() => {
      setCurrentCard(2);
      setAnimating(false);
    }, 300);
  };

  const prevCard = () => {
    if (animating) return;

    setDirection('right');
    setAnimating(true);
    setTimeout(() => {
      setCurrentCard(1);
      setAnimating(false);
    }, 300);
  };

  useEffect(() => {

    setTimeout(() => {
      const inputContainer = document.getElementsByClassName("luckysheet-input-box")[0] as HTMLElement;
      if (inputContainer) {
        inputContainer.style.left = "0px";
        inputContainer.style.top = "0px";
        inputContainer.style.display = "block";
        inputContainer.style.zIndex = "1000";
        inputContainer.style.boxShadow = "0 0px 0px rgb(0 0 0 / 40%)";

        const inner = inputContainer.getElementsByClassName("luckysheet-input-box-inner")[0] as HTMLElement;
        if (inner) {
          inner.style.minWidth = "100px";
          inner.style.minHeight = "21px";
          inner.style.boxShadow = "0 0px 0px rgb(0 0 0 / 40%)";
        }
      }
    }, 1000)


  }, []);

  const trynow = () => {
    sheetEditorRef.current?.setSelection([{ row: [5], column: [2] }]);
    sheetEditorRef.current?.setCellValue(5, 2, {
      ct: { fa: '@', t: 's' },
      m: "=GETTXLIST(\"",
      f: "=GETTXLIST(\"",
      v: "=GETTXLIST(\"",
    });
    console.log("clicked", document.getElementById("luckysheet-rich-text-editor"));
  }

  useEffect(() => {
    // Set timeout to allow component to mount first
    const timer = setTimeout(() => {
      setExpandInfoContainer(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Start animation after component mounts
    setTimeout(() => {
      setAnimationState('visible');
    }, 500);
  }, []);


  return (
    onboardingComplete ? <></> :
      <div>
        <div className="first-blue">
        </div>
        <div className=" wizard absolute w-full max-w-md h-16  overflow-hidden">
          {/* Container for SVG Image */}
          <div
            className="absolute inset-x-0 bottom-0 flex justify-center transition-all duration-200 ease-in-out"
            style={{
              height: animationState === 'visible' ? '100%' : '0%',
            }}
          >
            <img
              src={'https://raw.githubusercontent.com/mritunjayz/test-private/e78b4cc678b151eee498d3ff66c4f0678c288799/wizard_svg.svg'}
              alt="Animated SVG"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <div className="second-blue">
        </div>


        <div className={`onboarding-info-card w-[360px] border-[1px] border-grey-500 border-solid rounded-xl shadow-xl transition-all duration-1000 ease-in-out overflow-hidden ${expandInfoContainer ? 'h-[370px]' : 'h-0'}`}>
          <div className={`flex flex-col items-center justify-center w-full transition-opacity duration-1000 ${expandInfoContainer ? 'opacity-100' : 'opacity-0'}`}>
            <div className="relative bg-white w-full max-w-lg rounded-lg overflow-hidden">
              <div className="relative w-full bg-white rounded-md mb-2">
                <video
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src="https://github.com/mritunjayz/test-private/raw/refs/heads/main/GetData_demo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              <div className="relative overflow-hidden p-4 h-24 gap-2">
                {/* First Card Content */}
                <div
                  className={`absolute transition-all duration-300 ease-in-out ${currentCard === 1
                    ? 'translate-x-0 opacity-100'
                    : direction === 'left'
                      ? '-translate-x-full opacity-0'
                      : 'translate-x-full opacity-0'
                    }`}
                >
                  <h2 className="onboarding-info-header">Get real time Onchain data</h2>
                  <p className="onboarding-info-description">Get realtime data from blockchain via 1 function Lorem ipsum dolor sit amet💛</p>
                </div>

                {/* Second Card Content */}
                <div
                  className={`absolute w-full transition-all duration-300 ease-in-out ${currentCard === 2
                    ? 'translate-x-0 opacity-100'
                    : direction === 'left'
                      ? 'translate-x-full opacity-0'
                      : '-translate-x-full opacity-0'
                    }`}
                >
                  <h2 className="text-4xl font-bold mb-4">Advanced Analytics</h2>
                  <p className="text-2xl mb-2">Track transactions and monitor blockchain activity</p>
                  <p className="text-2xl mb-4">Real-time insights at your fingertips✨</p>
                </div>
              </div >

              <div className="flex justify-between items-center p-4">
                <div className="flex items-center">
                  <span className="">{currentCard} of 2</span>
                </div>

                <div className="flex gap-4">
                  {currentCard === 1 ? (
                    <button
                      onClick={nextCard}
                      className=""
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={prevCard}
                      className=""
                    >
                      Back
                    </button>
                  )}

                  <button className="bg-black text-white rounded-lg px-3 py-1" onClick={() => {
                    trynow()
                    setOnboardingComplete(true)
                    window.localStorage.setItem("onboardingComplete", "true")
                  }}>
                    Try now
                  </button>
                </div>
              </div>
            </div >
          </div >
        </div >
      </div >
  );
};
