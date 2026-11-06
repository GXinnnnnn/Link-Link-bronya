#include "llk.h"
#include <assert.h>

extern char Map[MapSize+2][MapSize+2];
extern int remaining, guan_count, helpcount;
void xipai();

static int checks=0;
static void check(bool value) { ++checks; if(!value) { fprintf(stderr,"FAILED at check %d\n",checks); exit(1); } }
int main()
{
    srand(42);
    memset(Map,0,sizeof(Map));
    int a[]={2,2}, b[]={6,2};
    Map[2][2]=Map[6][2]='A';
    check(TreeLines(a,b)==1);
    check(TreeLines(a,a)==0);
    Map[6][2]='B'; check(TreeLines(a,b)==0);
    Map[6][2]='A'; Map[4][2]='B'; check(TreeLines(a,b)==1);
    memset(Map,'B',sizeof(Map));
    for(int i=0;i<10;++i) Map[0][i]=Map[9][i]=Map[i][0]=Map[i][9]=0;
    a[0]=1;a[1]=1;b[0]=8;b[1]=1; Map[1][1]=Map[8][1]='A';
    check(TreeLines(a,b)==1); // outside border
    a[0]=2;a[1]=2;b[0]=6;b[1]=6;Map[2][2]=Map[6][6]='A';
    int corridor[][2]={{3,2},{4,2},{4,3},{4,4},{5,4},{6,4},{6,5}};
    for(auto &p:corridor) Map[p[0]][p[1]]=0;
    check(TreeLines(a,b)==0); // three turns must fail
    for(int level=1;level<=10;++level) for(int run=0;run<12;++run) {
        guan_count=level; Oninit_all(); CreateMap();
        check(remaining==64 && helpcount==4);
        int initial[26]={0};
        for(int x=1;x<=8;++x) for(int y=1;y<=8;++y) ++initial[Map[x][y]-'A'];
        for(int n:initial) check(n%2==0);
        for(int removed=0;removed<32;++removed) {
            for(int attempt=0;!Find_step_onexit() && attempt<1000;++attempt) xipai();
            check(Find_step_onexit()!=0);
            bool found=false;
            for(int x=1;x<=8 && !found;++x) for(int y=1;y<=8 && !found;++y) {
                if(!Map[x][y]) continue;
                for(int u=1;u<=8 && !found;++u) for(int v=1;v<=8 && !found;++v) {
                    int start[]={x,y},end[]={u,v};
                    if(TreeLines(start,end)) { Map[x][y]=Map[u][v]=0; remaining-=2; found=true; }
                }
            }
            check(found); MoveMap();
            int count=0,counts[26]={0};
            for(int x=1;x<=8;++x) for(int y=1;y<=8;++y) if(Map[x][y]) { ++count; ++counts[Map[x][y]-'A']; }
            check(count==remaining && remaining==62-removed*2);
            for(int n:counts) check(n%2==0);
            for(int i=0;i<10;++i) check(Map[0][i]==0 && Map[9][i]==0 && Map[i][0]==0 && Map[i][9]==0);
        }
        check(remaining==0);
    }
    printf("PASS: %d checks; 120 full games across 10 levels.\n",checks);
    return 0;
}
