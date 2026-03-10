import "./index.css";
import { Composition } from "remotion";
import { ProcessVideo } from "./ProcessVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CJSoftwareCheckerProcess"
        component={ProcessVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
