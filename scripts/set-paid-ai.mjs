import {requirePublishedSupport,setProduction,redeploy} from './ai-operator.mjs';
const mode=process.argv[2];
if(!['on','off'].includes(mode))throw new Error('Use npm run ai:paid -- on or off.');
if(process.argv.includes('--dry-run')){
 console.log(JSON.stringify({project:'fragout-wardrobe',environment:'production',paidEnabled:mode==='on',purchases:false,requiresRedeploy:true}));
}else try{
 await requirePublishedSupport();
 // Disarm first when disabling; arm last when enabling. No inference or purchase.
 if(mode==='off')setProduction('FRAGOUT_PAID_AI_ENABLED','false');
 setProduction('FRAGOUT_QWEN_BACKEND','auto');
 if(mode==='on')setProduction('FRAGOUT_PAID_AI_ENABLED','true');
 await redeploy(mode==='on');console.log('App-funded paid analysis is '+mode+'. No credits were purchased.');
}catch{console.error('Paid switch update did not complete. Inspect production configuration and deployment status; no values were displayed.');process.exitCode=1;}
