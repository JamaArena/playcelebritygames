export function turnToward(current,target,dt){
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*Math.min(1,dt*14);
}
export function smoothPath(start,points,valid){
  const result=[];let from=start,index=0;
  while(index<points.length){let next=index;
    for(let candidate=points.length-1;candidate>index;candidate--){const to=points[candidate],steps=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.08);let clear=true;
      for(let i=1;i<=steps;i++)if(!valid(from.x+(to.x-from.x)*i/steps,from.z+(to.z-from.z)*i/steps)){clear=false;break;}
      if(clear){next=candidate;break;}
    }
    result.push(points[next]);from=points[next];index=next+1;
  }
  return result;
}
