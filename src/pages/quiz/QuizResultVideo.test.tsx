import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import QuizResultVideo,{RESULT_VIDEOS} from './QuizResultVideo';
import {PROFILES} from '@/lib/quizLogic';
beforeEach(()=>{vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('has one distinct video for every result',()=>{expect(Object.keys(RESULT_VIDEOS).sort()).toEqual(Object.keys(PROFILES).sort());expect(new Set(Object.values(RESULT_VIDEOS)).size).toBe(7);});
it('restarts from zero with sound after a tap without pausing when controls appear',async()=>{
 const {container}=render(<QuizResultVideo profile="mixologia" poster="poster.jpg"/>);const player=container.querySelector('video')!;expect(player.muted).toBe(true);player.currentTime=14;
 fireEvent.click(screen.getByRole('button',{name:'Ouvir do início'}));await waitFor(()=>expect(player.controls).toBe(true));expect(player.currentTime).toBe(0);expect(player.muted).toBe(false);expect(player.loop).toBe(false);expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
});
it('provides a user-triggered play button when autoplay is denied',async()=>{
 vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(Error('autoplay denied'));
 render(<QuizResultVideo profile="pack" poster="poster.jpg"/>);const play=await screen.findByRole('button',{name:'Reproduzir com som'});fireEvent.click(play);await waitFor(()=>expect(screen.queryByRole('button')).toBeNull());
});
it('keeps a static fallback when the video cannot load',()=>{
 const {container}=render(<QuizResultVideo profile="clube" poster="poster.jpg"/>);fireEvent.error(container.querySelector('video')!);expect(screen.getByRole('img')).toHaveAttribute('src','poster.jpg');
});
